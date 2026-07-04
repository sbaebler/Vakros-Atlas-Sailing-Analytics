<?php
declare(strict_types=1);

// Loads configuration from the project .env (one dir above the web root) and opens a
// single shared PDO connection to MariaDB.

function env(string $key, ?string $default = null): ?string
{
    static $vars = null;
    if ($vars === null) {
        $vars = [];
        // Look for .env in the docroot (api/ is at docroot/api) and one level above it,
        // so secrets can be kept outside the web root. An explicit path wins.
        $candidates = array_filter([
            getenv('APP_ENV_FILE') ?: null,
            dirname(__DIR__, 2) . '/.env',
            dirname(__DIR__, 3) . '/.env',
        ]);
        foreach ($candidates as $path) {
            if (!is_readable($path)) {
                continue;
            }
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                    continue;
                }
                [$k, $v] = explode('=', $line, 2);
                $vars[trim($k)] = trim($v, " \t\"'");
            }
            break;
        }
        // Real environment variables win over the file.
        $vars = array_merge($vars, array_filter(getenv() ?: []));
    }
    return $vars[$key] ?? $default;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $host = env('DB_HOST', '127.0.0.1');
    $name = env('DB_NAME', 'vakaros');
    $port = env('DB_PORT', '3306');
    $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
    try {
        $pdo = new PDO($dsn, env('DB_USER', 'root'), env('DB_PASS', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        json_error('Database connection failed', 500);
    }
    return $pdo;
}
