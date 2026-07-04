<?php
declare(strict_types=1);

// Session-cookie authentication with double-submit CSRF protection.
//   - Login verifies the password and stores the user id + a CSRF token in the session.
//   - Mutating requests (POST/PUT/PATCH/DELETE) must echo the CSRF token in X-CSRF-Token.

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = ($_SERVER['HTTPS'] ?? '') !== '' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'secure' => $https,
        'samesite' => 'Strict',
    ]);
    session_name('vak_sess');
    session_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
}

function current_user_id(): ?int
{
    return isset($_SESSION['uid']) ? (int) $_SESSION['uid'] : null;
}

function require_auth(): int
{
    $uid = current_user_id();
    if ($uid === null) {
        json_error('Not authenticated', 401);
    }
    return $uid;
}

/** Enforce CSRF on state-changing verbs. */
function require_csrf(string $method): void
{
    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($token) || !hash_equals($_SESSION['csrf'] ?? '', $token)) {
            json_error('Invalid CSRF token', 403);
        }
    }
}

function login(string $email, string $password): bool
{
    $stmt = db()->prepare('SELECT id, password_hash FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($password, $row['password_hash'])) {
        return false;
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $row['id'];
    return true;
}

function logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
