<?php
/**
 * One-shot release installer for shared hosting (uploaded by .github/workflows/deploy-backend.yml).
 *
 * CI uploads release.zip + this file into the domain folder, POSTs here with the deploy token, and this
 * script unpacks the release, swaps code directories in place and deletes itself and the zip.
 *
 * Layout: static frontend at the root, Laravel in backend/.
 * - Directories in REPLACE_DIRS are swapped whole (no stale files left behind).
 * - Everything else is merged: files are overwritten, nothing on the server is deleted. That keeps
 *   backend/storage (uploads, logs, sessions) intact.
 * - No .env file is ever written; backend/.env lives only on the server.
 *
 * __TOKEN_SHA256__ is replaced at build time with sha256(DEPLOY_TOKEN).
 */

declare(strict_types=1);

const EXPECTED_TOKEN_HASH = '__TOKEN_SHA256__';
const ZIP_NAME = 'release.zip';

const REPLACE_DIRS = [
    '_next',
    'backend/app', 'backend/bootstrap', 'backend/config', 'backend/database', 'backend/lang',
    'backend/public', 'backend/resources', 'backend/routes', 'backend/vendor',
];

// What the old deploy (Laravel directly in the domain folder) left at the root.
const OLD_ROOT_LARAVEL = [
    'app', 'bootstrap', 'config', 'database', 'lang', 'public', 'resources', 'routes', 'vendor', 'storage',
    'artisan', 'composer.json', 'composer.lock', 'package.json', 'README.md', 'vite.config.js', 'phpunit.xml',
    '.ftp-deploy-sync-state.json',
];

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$root = __DIR__;
$zip = $root . '/' . ZIP_NAME;

$given = (string) ($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST'
    || strlen(EXPECTED_TOKEN_HASH) !== 64
    || !hash_equals(EXPECTED_TOKEN_HASH, hash('sha256', $given))) {
    http_response_code(404);
    exit;
}

ignore_user_abort(true);
set_time_limit(0);

$log = [];

function rrmdir(string $path): void
{
    if (is_link($path) || is_file($path)) {
        @unlink($path);
        return;
    }
    if (!is_dir($path)) {
        return;
    }
    foreach (scandir($path) ?: [] as $entry) {
        if ($entry !== '.' && $entry !== '..') {
            rrmdir($path . '/' . $entry);
        }
    }
    @rmdir($path);
}

function ensure_dir(string $dir): void
{
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException("Cannot create $dir");
    }
}

/** Moves the release tree $src onto the live tree $dst ($rel is the path relative to the domain folder). */
function install_tree(string $src, string $dst, string $rel): void
{
    ensure_dir($dst);
    foreach (scandir($src) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..' || $entry === '.env') {
            continue;
        }
        $from = "$src/$entry";
        $to = "$dst/$entry";
        $path = $rel === '' ? $entry : "$rel/$entry";

        if (is_dir($from) && in_array($path, REPLACE_DIRS, true)) {
            $old = "$dst/_old_{$entry}_" . bin2hex(random_bytes(4));
            if (file_exists($to) && !rename($to, $old)) {
                throw new RuntimeException("Cannot move aside $path");
            }
            if (!rename($from, $to)) {
                if (file_exists($old)) {
                    rename($old, $to); // roll this directory back
                }
                throw new RuntimeException("Cannot install $path");
            }
            rrmdir($old);
        } elseif (is_dir($from)) {
            install_tree($from, $to, $path);
        } elseif (!rename($from, $to)) {
            throw new RuntimeException("Cannot write $path");
        }
    }
}

/** Copies files from $src into $dst without overwriting anything that already exists there. */
function copy_missing(string $src, string $dst): void
{
    ensure_dir($dst);
    foreach (scandir($src) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        if (is_dir("$src/$entry")) {
            copy_missing("$src/$entry", "$dst/$entry");
        } elseif (!file_exists("$dst/$entry")) {
            copy("$src/$entry", "$dst/$entry");
        }
    }
}

/** First deploy after the layout change: carry .env and uploads over to backend/, then remove the old root install. */
function migrate_old_layout(string $root, array &$log): void
{
    if (!is_file("$root/artisan") || !is_dir("$root/backend")) {
        return;
    }
    if (is_file("$root/.env") && !is_file("$root/backend/.env")) {
        if (!rename("$root/.env", "$root/backend/.env")) {
            throw new RuntimeException('Cannot move .env into backend/');
        }
        $log[] = 'moved .env to backend/.env';
    }
    if (is_dir("$root/storage/app")) {
        copy_missing("$root/storage/app", "$root/backend/storage/app");
        $log[] = 'copied storage/app into backend/storage/app';
    }
    foreach (OLD_ROOT_LARAVEL as $entry) {
        if (file_exists("$root/$entry")) {
            rrmdir("$root/$entry");
        }
    }
    @unlink("$root/.env"); // only still here if backend/.env already existed
    $log[] = 'removed the old Laravel install from the domain root';
}

$stage = $root . '/_release_' . bin2hex(random_bytes(6));
$status = 200;

try {
    if (!class_exists(ZipArchive::class)) {
        throw new RuntimeException('PHP zip extension (ZipArchive) is not available');
    }
    $archive = new ZipArchive();
    if ($archive->open($zip) !== true) {
        throw new RuntimeException('Cannot open ' . ZIP_NAME);
    }
    if (!$archive->extractTo($stage)) {
        throw new RuntimeException('Extraction failed');
    }
    $archive->close();

    install_tree($stage, $root, '');
    migrate_old_layout($root, $log);

    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
    foreach ($log as $line) {
        echo "- $line\n";
    }
    echo "OK: release installed\n";
    // bootstrap/app.php prefers /home/<user>/envs/arentertainmentkr.env, then backend/.env.
    if (!is_file(dirname($root) . '/envs/arentertainmentkr.env') && !is_file("$root/backend/.env")) {
        echo "WARNING: no env file found (envs/arentertainmentkr.env or backend/.env) - the API will not work until it is created.\n";
    }
} catch (Throwable $e) {
    $status = 500;
    echo 'FAILED: ' . $e->getMessage() . "\n";
} finally {
    rrmdir($stage);
    @unlink($zip);
    @unlink(__FILE__);
}

http_response_code($status);
