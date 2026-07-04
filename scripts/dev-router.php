<?php
// Local full-stack server for testing the production build together with the API.
//   php -S 127.0.0.1:8000 scripts/dev-router.php   (run from the repo root)
// Serves static files from public/, routes /api to the PHP front controller, and
// falls back to index.html for SPA routes.

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';

if (preg_match('#^/api(/|$)#', $uri)) {
    require __DIR__ . '/../api/index.php';
    return true;
}

$file = __DIR__ . '/../public' . $uri;
if ($uri !== '/' && is_file($file)) {
    return false; // let the built-in server serve the static asset
}
require __DIR__ . '/../public/index.html';
