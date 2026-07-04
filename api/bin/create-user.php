<?php
declare(strict_types=1);

// CLI: create or update a user (there is no public sign-up).
//   php api/bin/create-user.php <email> <password>

require __DIR__ . '/../lib/http.php';
require __DIR__ . '/../lib/db.php';

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}
$email = $argv[1] ?? null;
$password = $argv[2] ?? null;
if (!$email || !$password) {
    fwrite(STDERR, "Usage: php api/bin/create-user.php <email> <password>\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = db()->prepare(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)'
);
$stmt->execute([$email, $hash]);
echo "User '$email' created/updated.\n";
