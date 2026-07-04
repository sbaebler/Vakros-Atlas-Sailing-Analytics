<?php
declare(strict_types=1);

// Front controller for the JSON API. All /api/* requests are rewritten here by
// public/.htaccess. Routing is a small manual dispatcher over method + path segments.

require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/storage.php';
require __DIR__ . '/routes/auth.php';
require __DIR__ . '/routes/boats.php';
require __DIR__ . '/routes/polars.php';
require __DIR__ . '/routes/sessions.php';

start_session();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Path after the /api prefix, e.g. "boats/12/polars" -> ['boats','12','polars'].
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$path = preg_replace('#^.*?/api/?#', '', $uri);
$seg = array_values(array_filter(explode('/', trim($path, '/')), fn($s) => $s !== ''));

try {
    require_csrf($method);
    dispatch($method, $seg);
    json_error('Not found', 404);
} catch (Throwable $e) {
    // Log server-side, return a generic message to the client.
    error_log('API error: ' . $e->getMessage());
    json_error('Internal server error', 500);
}

function dispatch(string $method, array $seg): void
{
    $n = count($seg);
    $r0 = $seg[0] ?? '';

    // --- Public auth endpoints ---
    if ($r0 === 'auth' && ($seg[1] ?? '') === 'login' && $method === 'POST') {
        handle_login();
    }
    if ($r0 === 'auth' && ($seg[1] ?? '') === 'logout' && $method === 'POST') {
        handle_logout();
    }
    if ($r0 === 'me' && $n === 1 && $method === 'GET') {
        handle_me();
    }

    // --- Everything below requires authentication ---
    $uid = require_auth();

    // /boats , /boats/:id , /boats/:id/polars
    if ($r0 === 'boats') {
        if ($n === 1 && $method === 'GET') handle_boats_list($uid);
        if ($n === 1 && $method === 'POST') handle_boat_create($uid);
        if ($n === 2 && $method === 'PUT') handle_boat_update($uid, (int) $seg[1]);
        if ($n === 2 && $method === 'DELETE') handle_boat_delete($uid, (int) $seg[1]);
        if ($n === 3 && $seg[2] === 'polars' && $method === 'GET') handle_polars_list($uid, (int) $seg[1]);
        if ($n === 3 && $seg[2] === 'polars' && $method === 'POST') handle_polar_create($uid, (int) $seg[1]);
    }

    // /polars/:id
    if ($r0 === 'polars' && $n === 2) {
        if ($method === 'PUT') handle_polar_update($uid, (int) $seg[1]);
        if ($method === 'DELETE') handle_polar_delete($uid, (int) $seg[1]);
    }

    // /sessions , /sessions/:id , /sessions/:id/track
    if ($r0 === 'sessions') {
        if ($n === 1 && $method === 'GET') handle_sessions_list($uid);
        if ($n === 1 && $method === 'POST') handle_session_create($uid);
        if ($n === 2 && $method === 'GET') handle_session_get($uid, (int) $seg[1]);
        if ($n === 2 && $method === 'PUT') handle_session_update($uid, (int) $seg[1]);
        if ($n === 2 && $method === 'DELETE') handle_session_delete($uid, (int) $seg[1]);
        if ($n === 3 && $seg[2] === 'track' && $method === 'GET') handle_session_track($uid, (int) $seg[1]);
    }
}
