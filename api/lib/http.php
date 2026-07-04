<?php
declare(strict_types=1);

// Tiny HTTP helpers for the JSON API.

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400): never
{
    json_out(['error' => $message], $status);
}

/** Decode the JSON request body, or [] when empty. */
function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_error('Invalid JSON body', 400);
    }
    return $data;
}

function require_fields(array $body, array $fields): void
{
    foreach ($fields as $f) {
        if (!array_key_exists($f, $body) || $body[$f] === '' || $body[$f] === null) {
            json_error("Missing field: $f", 422);
        }
    }
}
