// Converts the site's static JPEG/PNG images in public/ to WebP and removes the originals.
// Usage: npm run images:webp
// App icons stay PNG on purpose: the web manifest, favicon and Apple touch icon expect PNG.
import { readdir, rm, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import sharp from "sharp";

const roots = ["public/images", "public/brand"];
const keepPng = /^icon-\d+\.png$/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

let saved = 0;
for (const root of roots) {
  for await (const file of walk(root)) {
    const ext = extname(file).toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(ext) || keepPng.test(file.split(/[\\/]/).pop())) continue;
    const out = file.slice(0, -ext.length) + ".webp";
    // Logos keep every pixel; photographs use lossy compression.
    const options = ext === ".png" ? { lossless: true } : { quality: 80, effort: 6 };
    await sharp(file).webp(options).toFile(out);
    const [before, after] = [(await stat(file)).size, (await stat(out)).size];
    saved += before - after;
    await rm(file);
    console.log(`${relative(".", file)} -> ${relative(".", out)}  ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
  }
}
console.log(`Saved ${Math.round(saved / 1024)} KB.`);
