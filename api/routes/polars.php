<?php
declare(strict_types=1);

// Polars belong to a boat. Data is a { twsValues, twaValues, speeds[][] } grid.

function handle_polars_list(int $uid, int $boatId): never
{
    if (!boat_owned($uid, $boatId)) {
        json_error('Boat not found', 404);
    }
    $stmt = db()->prepare('SELECT id, boat_id, name, source, data, created_at
                           FROM polars WHERE boat_id = ? ORDER BY created_at DESC');
    $stmt->execute([$boatId]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['data'] = json_decode($r['data'], true);
    }
    json_out($rows);
}

function handle_polar_create(int $uid, int $boatId): never
{
    if (!boat_owned($uid, $boatId)) {
        json_error('Boat not found', 404);
    }
    $b = json_body();
    require_fields($b, ['name', 'data']);
    validate_polar_data($b['data']);
    $stmt = db()->prepare('INSERT INTO polars (boat_id, name, source, data) VALUES (?, ?, ?, ?)');
    $stmt->execute([
        $boatId,
        (string) $b['name'],
        (string) ($b['source'] ?? ''),
        json_encode($b['data'], JSON_UNESCAPED_SLASHES),
    ]);
    json_out(['id' => (int) db()->lastInsertId()], 201);
}

function polar_owned(int $uid, int $polarId): bool
{
    $stmt = db()->prepare('SELECT 1 FROM polars p JOIN boats b ON b.id = p.boat_id
                           WHERE p.id = ? AND b.user_id = ?');
    $stmt->execute([$polarId, $uid]);
    return (bool) $stmt->fetchColumn();
}

function handle_polar_update(int $uid, int $id): never
{
    if (!polar_owned($uid, $id)) {
        json_error('Polar not found', 404);
    }
    $b = json_body();
    require_fields($b, ['name', 'data']);
    validate_polar_data($b['data']);
    $stmt = db()->prepare('UPDATE polars SET name = ?, source = ?, data = ? WHERE id = ?');
    $stmt->execute([
        (string) $b['name'],
        (string) ($b['source'] ?? ''),
        json_encode($b['data'], JSON_UNESCAPED_SLASHES),
        $id,
    ]);
    json_out(['ok' => true]);
}

function handle_polar_delete(int $uid, int $id): never
{
    if (!polar_owned($uid, $id)) {
        json_error('Polar not found', 404);
    }
    db()->prepare('DELETE FROM polars WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

function validate_polar_data(mixed $data): void
{
    if (
        !is_array($data) ||
        !isset($data['twsValues'], $data['twaValues'], $data['speeds']) ||
        !is_array($data['twsValues']) || !is_array($data['twaValues']) || !is_array($data['speeds'])
    ) {
        json_error('Invalid polar data: expected { twsValues, twaValues, speeds }', 422);
    }
    if (count($data['speeds']) !== count($data['twaValues'])) {
        json_error('Polar speeds rows must match twaValues length', 422);
    }
}
