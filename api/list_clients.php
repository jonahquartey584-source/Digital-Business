<?php
// Admin-only endpoint: lists every client row, newest first. Called by
// admin.html's "Existing Clients" list on login and on demand (Refresh).

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admin_auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

if (!require_admin_session()) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not logged in — log into admin.html again']);
    exit;
}

try {
    $pdo = get_db();
    $stmt = $pdo->query(
        'SELECT account_number, activation_code, title, service, price, preview, preview_image_url, preview_file_url, deliverable_file_url, payment_url, live_url, status, created_at, activated_at
         FROM clients
         ORDER BY created_at DESC'
    );
    $rows = $stmt->fetchAll();
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
    exit;
}

$clients = array_map(function ($row) {
    return [
        'account' => $row['account_number'],
        'code' => $row['activation_code'],
        'title' => $row['title'],
        'service' => $row['service'],
        'price' => $row['price'],
        'preview' => $row['preview'],
        'previewImageUrl' => $row['preview_image_url'],
        'previewFileUrl' => $row['preview_file_url'],
        'deliverableFileUrl' => $row['deliverable_file_url'],
        'paymentUrl' => $row['payment_url'],
        'liveUrl' => $row['live_url'],
        'status' => $row['status'],
        'createdAt' => $row['created_at'],
        'activatedAt' => $row['activated_at'],
    ];
}, $rows);

echo json_encode(['status' => 'ok', 'clients' => $clients]);
