<?php
declare(strict_types=1);

// Sessions store analyzed tracks. The heavy sample array is written to gzip storage;
// metadata, stats, wind and the cached analysis summary go in the DB.

function handle_sessions_list(int $uid): never
{
    $stmt = db()->prepare(
        'SELECT s.id, s.name, s.sailed_at, s.source_format, s.duration_s, s.stats,
                s.boat_id, b.name AS boat_name, b.boat_class, s.created_at
         FROM sessions s LEFT JOIN boats b ON b.id = s.boat_id
         WHERE s.user_id = ? ORDER BY s.sailed_at DESC, s.created_at DESC'
    );
    $stmt->execute([$uid]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['stats'] = $r['stats'] ? json_decode($r['stats'], true) : null;
    }
    json_out($rows);
}

function handle_session_get(int $uid, int $id): never
{
    $row = session_row($uid, $id);
    if (!$row) {
        json_error('Session not found', 404);
    }
    foreach (['stats', 'wind_meta', 'analysis'] as $k) {
        $row[$k] = $row[$k] ? json_decode($row[$k], true) : null;
    }
    unset($row['track_file']);
    json_out($row);
}

/** The full sample array for charting/mapping, streamed from gzip storage. */
function handle_session_track(int $uid, int $id): never
{
    $row = session_row($uid, $id);
    if (!$row) {
        json_error('Session not found', 404);
    }
    $json = read_track($row['track_file']);
    if ($json === null) {
        json_error('Track data unavailable', 404);
    }
    header('Content-Type: application/json; charset=utf-8');
    if (str_contains($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip')) {
        header('Content-Encoding: gzip');
        echo gzencode($json, 6);
    } else {
        echo $json;
    }
    exit;
}

function handle_session_create(int $uid): never
{
    $b = json_body();
    require_fields($b, ['name', 'samples']);
    if (!is_array($b['samples']) || count($b['samples']) === 0) {
        json_error('samples must be a non-empty array', 422);
    }
    $boatId = isset($b['boat_id']) ? (int) $b['boat_id'] : null;
    if ($boatId !== null && !boat_owned($uid, $boatId)) {
        json_error('Boat not found', 404);
    }
    $trackFile = store_track($uid, $b['samples']);
    $stmt = db()->prepare(
        'INSERT INTO sessions
           (user_id, boat_id, name, sailed_at, source_format, duration_s, stats, wind_meta, analysis, track_file)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $uid,
        $boatId,
        (string) $b['name'],
        isset($b['sailed_at']) ? (string) $b['sailed_at'] : null,
        (string) ($b['source_format'] ?? 'vkx'),
        (int) ($b['duration_s'] ?? 0),
        isset($b['stats']) ? json_encode($b['stats'], JSON_UNESCAPED_SLASHES) : null,
        isset($b['wind_meta']) ? json_encode($b['wind_meta'], JSON_UNESCAPED_SLASHES) : null,
        isset($b['analysis']) ? json_encode($b['analysis'], JSON_UNESCAPED_SLASHES) : null,
        $trackFile,
    ]);
    json_out(['id' => (int) db()->lastInsertId()], 201);
}

/** Update editable metadata / cached analysis (e.g. after re-running with new wind). */
function handle_session_update(int $uid, int $id): never
{
    $row = session_row($uid, $id);
    if (!$row) {
        json_error('Session not found', 404);
    }
    $b = json_body();
    $boatId = array_key_exists('boat_id', $b)
        ? ($b['boat_id'] === null ? null : (int) $b['boat_id'])
        : $row['boat_id'];
    if ($boatId !== null && !boat_owned($uid, $boatId)) {
        json_error('Boat not found', 404);
    }
    $stmt = db()->prepare(
        'UPDATE sessions SET name = ?, boat_id = ?, stats = ?, wind_meta = ?, analysis = ?
         WHERE id = ? AND user_id = ?'
    );
    $stmt->execute([
        (string) ($b['name'] ?? $row['name']),
        $boatId,
        array_key_exists('stats', $b) ? json_encode($b['stats'], JSON_UNESCAPED_SLASHES) : $row['stats'],
        array_key_exists('wind_meta', $b) ? json_encode($b['wind_meta'], JSON_UNESCAPED_SLASHES) : $row['wind_meta'],
        array_key_exists('analysis', $b) ? json_encode($b['analysis'], JSON_UNESCAPED_SLASHES) : $row['analysis'],
        $id,
        $uid,
    ]);
    json_out(['ok' => true]);
}

function handle_session_delete(int $uid, int $id): never
{
    $row = session_row($uid, $id);
    if (!$row) {
        json_error('Session not found', 404);
    }
    delete_track($row['track_file']);
    db()->prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')->execute([$id, $uid]);
    json_out(['ok' => true]);
}

function session_row(int $uid, int $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $uid]);
    return $stmt->fetch() ?: null;
}
