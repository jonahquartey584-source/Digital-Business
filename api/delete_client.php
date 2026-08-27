<?php
// Admin-only endpoint: permanently deletes a client row. Called from
// admin.html's "Existing Clients" list — a destructive, irreversible
// action, so admin.js confirms with the user before ever calling this.

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admin_auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

if (!require_admin_session()) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not logged in — log into admin.html again']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$account = strtoupper(trim((string) ($input['account'] ?? '')));

if ($account === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Account is required']);
    exit;
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare('DELETE FROM clients WHERE account_number = :account');
    $stmt->execute(['account' => $account]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'No client with that account number']);
        exit;
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
    exit;
}

echo json_encode(['status' => 'deleted', 'account' => $account]);
