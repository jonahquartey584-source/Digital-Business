<?php
/**
 * Drop this at the very top of a client's site entry point (e.g. their
 * index.php) to keep it hidden until they've paid. This is how "the
 * website goes live automatically" actually happens: the site's files
 * are already uploaded, but this gate blocks them until webhook.php
 * flips that client's status to 'active'.
 *
 * Usage — at the very top of the client's index.php, before any HTML:
 *
 *   <?php
 *   define('CLIENT_ACCOUNT_NUMBER', 'QP-2026-0158');
 *   require __DIR__ . '/../../api/gate.php'; // adjust the path depth
 *   ?>
 *   <!doctype html>
 *   ... the rest of their real site ...
 */

require_once __DIR__ . '/db.php';

if (!defined('CLIENT_ACCOUNT_NUMBER')) {
    http_response_code(500);
    die('Gate misconfigured: CLIENT_ACCOUNT_NUMBER not set.');
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare('SELECT status FROM clients WHERE account_number = :account LIMIT 1');
    $stmt->execute(['account' => CLIENT_ACCOUNT_NUMBER]);
    $client = $stmt->fetch();
} catch (PDOException $e) {
    http_response_code(500);
    die('Gate error: could not check activation status.');
}

if (!$client || $client['status'] !== 'active') {
    http_response_code(402);
    ?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Coming Soon</title>
  <meta name="robots" content="noindex" />
</head>
<body style="font-family: system-ui, sans-serif; text-align: center; padding: 80px 20px; background: #0c0b09; color: #f4eee2;">
  <h1>This site isn't live yet</h1>
  <p>It will go live automatically as soon as payment is confirmed.</p>
</body>
</html>
    <?php
    exit;
}

// Status is 'active' — fall through and let the client's real page render.
