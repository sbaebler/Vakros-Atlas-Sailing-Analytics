<?php
declare(strict_types=1);

function handle_login(): never
{
    $b = json_body();
    require_fields($b, ['email', 'password']);
    if (!login((string) $b['email'], (string) $b['password'])) {
        json_error('Invalid email or password', 401);
    }
    json_out(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

function handle_logout(): never
{
    logout();
    json_out(['ok' => true]);
}

/** Current session info; the frontend reads the CSRF token from here on load. */
function handle_me(): never
{
    $uid = current_user_id();
    if ($uid === null) {
        json_out(['authenticated' => false, 'csrf' => $_SESSION['csrf']]);
    }
    $stmt = db()->prepare('SELECT id, email FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $user = $stmt->fetch() ?: null;
    json_out(['authenticated' => true, 'user' => $user, 'csrf' => $_SESSION['csrf']]);
}
