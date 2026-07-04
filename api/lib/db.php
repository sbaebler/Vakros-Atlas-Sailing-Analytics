<?php
declare(strict_types=1);

// Loads configuration from the project .env.vakaros (one dir above the web root) and
// opens a single shared PDO connection to MariaDB. Named .env.vakaros rather than .env
// so it doesn't collide with other apps' env files sharing the same account home
// directory (e.g. on shared hosting like Cyon).

function env(string $key, ?string $default = null): ?string
{
    static $vars = null;
    if ($vars === null) {
        $vars = [];
        // Look for .env.vakaros in the docroot (api/ is at docroot/api), one level above
        // it, and two levels above it, so secrets can be kept outside the web root. The
        // "one level above" candidate only helps when the docroot itself isn't nested
        // inside another site's web root (e.g. a Cyon subdomain living at
        // public_html/<sub>/, where one level up is still public_html — the primary
        // domain's own docroot, and thus still publicly servable). The "two levels above"
        // candidate reaches the account home directory in that layout, which is never
        // web-servable. An explicit path wins.
        $candidates = array_filter([
            getenv('APP_ENV_FILE') ?: null,
            dirname(__DIR__, 4) . '/.env.vakaros',
            dirname(__DIR__, 3) . '/.env.vakaros',
            dirname(__DIR__, 2) . '/.env.vakaros',
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
