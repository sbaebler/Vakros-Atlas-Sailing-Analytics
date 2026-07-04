<?php
declare(strict_types=1);

// Bulk track data (thousands of samples) lives as gzip-compressed JSON on disk, outside
// the web root, referenced from the sessions table. Keeps the database lean.

function storage_dir(): string
{
    $dir = env('STORAGE_DIR', dirname(__DIR__, 2) . '/storage');
    $tracks = $dir . '/tracks';
    if (!is_dir($tracks)) {
        mkdir($tracks, 0770, true);
    }
    return $dir;
}

/** Store a track payload; returns the relative filename to save in the DB. */
function store_track(int $userId, array $samples): string
{
    $name = 'tracks/' . $userId . '_' . bin2hex(random_bytes(8)) . '.json.gz';
    $path = storage_dir() . '/' . $name;
    $json = json_encode($samples, JSON_UNESCAPED_SLASHES);
    $gz = gzencode($json, 6);
    if ($gz === false || file_put_contents($path, $gz) === false) {
        json_error('Failed to store track data', 500);
    }
    return $name;
}

function read_track(string $name): ?string
{
    // Guard against path traversal: only our generated basenames are allowed.
    if (!preg_match('#^tracks/[0-9]+_[0-9a-f]{16}\.json\.gz$#', $name)) {
        return null;
    }
    $path = storage_dir() . '/' . $name;
    if (!is_readable($path)) {
        return null;
    }
    $gz = file_get_contents($path);
    $json = $gz === false ? false : gzdecode($gz);
    return $json === false ? null : $json;
}

function delete_track(?string $name): void
{
    if ($name && preg_match('#^tracks/[0-9]+_[0-9a-f]{16}\.json\.gz$#', $name)) {
        @unlink(storage_dir() . '/' . $name);
    }
}
