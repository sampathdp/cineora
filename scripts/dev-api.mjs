#!/usr/bin/env node
/**
 * Local API server with several PHP workers (used by `npm run dev`).
 *
 * `php artisan serve` handles one request at a time on Windows (PHP_CLI_SERVER_WORKERS is not supported there),
 * so an admin page that loads three lists at once waits for them one after another. This starts API_WORKERS
 * (default 4) PHP built-in servers on internal ports and a small proxy on API_PORT (default 8000) that hands
 * each request to the least busy worker. The Host header is passed through unchanged, so cookies, CSRF and
 * generated URLs behave exactly as with `php artisan serve` on :8000.
 *
 * Usage: node scripts/dev-api.mjs   (env: API_PORT, API_WORKERS, PHP_BINARY)
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "backend", "public");
const router = path.join(root, "backend", "vendor", "laravel", "framework", "src", "Illuminate", "Foundation", "resources", "server.php");

const port = Number(process.env.API_PORT ?? 8000);
const count = Math.max(1, Number(process.env.API_WORKERS ?? 4));
const php = process.env.PHP_BINARY ?? "php";

const workers = Array.from({ length: count }, (_, i) => {
  const workerPort = port + 100 + i;
  const child = spawn(
    php,
    // OPcache is off for CLI by default, which makes PHP recompile the framework on every request.
    // revalidate_freq=0 keeps code edits visible immediately.
    ["-d", "opcache.enable_cli=1", "-d", "opcache.revalidate_freq=0", "-S", `127.0.0.1:${workerPort}`, router],
    { cwd: publicDir, stdio: ["ignore", "ignore", "pipe"] },
  );
  // The built-in server logs every request to stderr; only pass on real PHP warnings and errors.
  child.stderr.on("data", (buf) => {
    for (const line of String(buf).split(/\r?\n/)) {
      if (line && !/ (Accepted|Closing|\[\d{3}\]:|Development Server)/.test(line)) process.stderr.write(`[php:${workerPort}] ${line}\n`);
    }
  });
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`PHP worker on ${workerPort} exited (${code}). Stopping.`);
      shutdown(1);
    }
  });
  return { port: workerPort, child, busy: 0 };
});

function handle(req, res) {
  const w = workers.reduce((a, b) => (b.busy < a.busy ? b : a));
  w.busy++;
  const started = Date.now();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      w.busy--;
    }
  };

  const upstream = http.request(
    { host: "127.0.0.1", port: w.port, method: req.method, path: req.url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.rawHeaders);
      up.pipe(res);
      up.on("end", () => {
        release();
        if (!req.url?.startsWith("/storage/")) {
          console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.url} ${up.statusCode} ${Date.now() - started}ms`);
        }
      });
    },
  );
  upstream.on("error", (e) => {
    release();
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, message: `API worker unavailable: ${e.message}` }));
  });
  req.on("aborted", () => {
    upstream.destroy();
    release();
  });
  req.pipe(upstream);
}

// Listen on IPv4 and IPv6 loopback: on Windows "localhost" resolves to ::1 first, and a server on 127.0.0.1 only
// makes every new connection wait for that attempt to fail. Still loopback only, never the LAN.
const servers = [http.createServer(handle), http.createServer(handle)];

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const s of servers) s.close();
  for (const w of workers) w.child.kill();
  process.exit(code);
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
process.on("exit", () => workers.forEach((w) => w.child.kill()));

servers[0].listen(port, "127.0.0.1", () => {
  console.log(`API on http://localhost:${port} -> ${count} PHP workers (${workers.map((w) => w.port).join(", ")})`);
});
servers[0].on("error", (e) => {
  console.error(`Cannot listen on 127.0.0.1:${port}: ${e.message}`);
  shutdown(1);
});
servers[1].on("error", () => {}); // no IPv6 loopback on this machine: IPv4 alone is fine
servers[1].listen(port, "::1");
