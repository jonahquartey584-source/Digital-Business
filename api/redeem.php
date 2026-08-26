<?php
// Looks up an account number + activation code against the clients table.
// Called by activate.js when a client submits the redeem form.

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$account = strtoupper(trim((string) ($input['account'] ?? '')));
$code = strtoupper(trim((string) ($input['code'] ?? '')));

if ($account === '' || $code === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Account and code are required']);
    exit;
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare(
        'SELECT account_number, title, service, price, preview, preview_image_url, preview_link_url, payment_url, live_url, status
         FROM clients
         WHERE account_number = :account AND activation_code = :code
         LIMIT 1'
    );
    $stmt->execute(['account' => $account, 'code' => $code]);
    $client = $stmt->fetch();
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
    exit;
}

if (!$client) {
    echo json_encode(['status' => 'no_match']);
    exit;
}

echo json_encode([
    'status' => 'match_found',
    'account' => $client['account_number'],
    'title' => $client['title'],
    'service' => $client['service'],
    'price' => $client['price'],
    'preview' => $client['preview'],
    'previewImageUrl' => $client['preview_image_url'],
    'previewLinkUrl' => $client['preview_link_url'],
    'paymentUrl' => $client['payment_url'],
    'liveUrl' => $client['live_url'],
    // 'pending_payment' or 'active' — activate.js shows a different result
    // for a client who has already paid vs one who's still due to pay.
    'activeStatus' => $client['status'],
]);
