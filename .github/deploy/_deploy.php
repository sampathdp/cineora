<?php
/**
 * One-shot release installer for shared hosting (uploaded by deploy-backend.yml).
 *
 * CI uploads release.zip + this file over FTP, POSTs here with the deploy token,
 * and this script unpacks the release next to itself, swaps the code directories
 * in place and deletes itself and the zip. It never touches .env, and storage/ is
 * merged (never replaced) so uploads, logs and sessions survive.
 *
 * __TOKEN_SHA256__ is replaced at build time with sha256(DEPLOY_TOKEN).
 */

declare(strict_types=1);

const EXPECTED_TOKEN_HASH = '__TOKEN_SHA256__';
const ZIP_NAME = 'release.zip';

// Top-level directories that are fully replaced by the release.
const REPLACE_DIRS = ['app', 'bootstrap', 'config', 'database', 'lang', 'public', 'resources', 'routes', 'vendor'];

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

/** Copy $src into $dst, overwriting files but never deleting anything in $dst. */
function merge_dir(string $src, string $dst): void
{
    if (!is_dir($dst) && !mkdir($dst, 0755, true) && !is_dir($dst)) {
        throw new RuntimeException("Cannot create $dst");
    }
    foreach (scandir($src) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $from = "$src/$entry";
        $to = "$dst/$entry";
        if (is_dir($from)) {
            merge_dir($from, $to);
        } elseif (!rename($from, $to)) {
            throw new RuntimeException("Cannot write $to");
        }
    }
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

    foreach (scandir($stage) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..' || $entry === '.env') {
            continue;
        }
        $new = "$stage/$entry";
        $live = "$root/$entry";

        if (is_dir($new) && in_array($entry, REPLACE_DIRS, true)) {
            $old = "$root/_old_{$entry}_" . bin2hex(random_bytes(4));
            if (file_exists($live) && !rename($live, $old)) {
                throw new RuntimeException("Cannot move aside $entry");
            }
            if (!rename($new, $live)) {
                if (file_exists($old)) {
                    rename($old, $live); // roll this directory back
                }
                throw new RuntimeException("Cannot install $entry");
            }
            rrmdir($old);
        } elseif (is_dir($new)) {
            merge_dir($new, $live); // storage/ and anything unknown: merge only
        } elseif (!rename($new, $live)) {
            throw new RuntimeException("Cannot write $entry");
        }
    }

    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
    echo "OK: release installed\n";
} catch (Throwable $e) {
    $status = 500;
    echo 'FAILED: ' . $e->getMessage() . "\n";
} finally {
    rrmdir($stage);
    @unlink($zip);
    @unlink(__FILE__);
}

http_response_code($status);
