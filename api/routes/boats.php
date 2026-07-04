<?php
declare(strict_types=1);

// Boats own the boat-type metadata (class) that is not present in the raw device data,
// plus their polars. All queries are scoped to the authenticated user.

function boat_owned(int $uid, int $boatId): bool
{
    $stmt = db()->prepare('SELECT 1 FROM boats WHERE id = ? AND user_id = ?');
    $stmt->execute([$boatId, $uid]);
    return (bool) $stmt->fetchColumn();
}

function handle_boats_list(int $uid): never
{
    $stmt = db()->prepare('SELECT id, name, boat_class, sail_number, notes, created_at
                           FROM boats WHERE user_id = ? ORDER BY name');
    $stmt->execute([$uid]);
    json_out($stmt->fetchAll());
}

function handle_boat_create(int $uid): never
{
    $b = json_body();
    require_fields($b, ['name']);
    $stmt = db()->prepare('INSERT INTO boats (user_id, name, boat_class, sail_number, notes)
                           VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([
        $uid,
        (string) $b['name'],
        (string) ($b['boat_class'] ?? ''),
        (string) ($b['sail_number'] ?? ''),
        isset($b['notes']) ? (string) $b['notes'] : null,
    ]);
    json_out(['id' => (int) db()->lastInsertId()], 201);
}

function handle_boat_update(int $uid, int $id): never
{
    if (!boat_owned($uid, $id)) {
        json_error('Boat not found', 404);
    }
    $b = json_body();
    require_fields($b, ['name']);
    $stmt = db()->prepare('UPDATE boats SET name = ?, boat_class = ?, sail_number = ?, notes = ?
                           WHERE id = ? AND user_id = ?');
    $stmt->execute([
        (string) $b['name'],
        (string) ($b['boat_class'] ?? ''),
        (string) ($b['sail_number'] ?? ''),
        isset($b['notes']) ? (string) $b['notes'] : null,
        $id,
        $uid,
    ]);
    json_out(['ok' => true]);
}

function handle_boat_delete(int $uid, int $id): never
{
    if (!boat_owned($uid, $id)) {
        json_error('Boat not found', 404);
    }
    $stmt = db()->prepare('DELETE FROM boats WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $uid]);
    json_out(['ok' => true]);
}
