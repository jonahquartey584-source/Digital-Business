<?php
// Admin-only endpoint: creates a new client row (account number, code,
// service, price, preview text/image, payment link). Called from
// admin.html's "Save to Database" button. Requires the admin password.

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

if (!hash_equals(ADMIN_PASSWORD, (string) ($input['adminPassword'] ?? ''))) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Wrong admin password']);
    exit;
}

$account = strtoupper(trim((string) ($input['account'] ?? '')));
$code = strtoupper(trim((string) ($input['code'] ?? '')));
$title = trim((string) ($input['title'] ?? ''));
$service = trim((string) ($input['service'] ?? ''));
$price = trim((string) ($input['price'] ?? ''));
$preview = trim((string) ($input['preview'] ?? ''));
$previewImageUrl = trim((string) ($input['previewImageUrl'] ?? ''));
$paymentUrl = trim((string) ($input['paymentUrl'] ?? ''));
$liveUrl = trim((string) ($input['liveUrl'] ?? ''));

if ($account === '' || $code === '' || $service === '' || $price === '' || $paymentUrl === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
    exit;
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare(
        "INSERT INTO clients (account_number, activation_code, title, service, price, preview, preview_image_url, payment_url, live_url, status)
         VALUES (:account, :code, :title, :service, :price, :preview, :preview_image_url, :payment_url, :live_url, 'pending_payment')"
    );
    $stmt->execute([
        'account' => $account,
        'code' => $code,
        'title' => $title !== '' ? $title : null,
        'service' => $service,
        'price' => $price,
        'preview' => $preview,
        'preview_image_url' => $previewImageUrl !== '' ? $previewImageUrl : null,
        'payment_url' => $paymentUrl,
        'live_url' => $liveUrl !== '' ? $liveUrl : null,
    ]);
} catch (PDOException $e) {
    // Most likely cause: account_number already exists (UNIQUE constraint).
    http_response_code(409);
    echo json_encode(['status' => 'error', 'message' => 'That account number already exists — try again to generate a new one']);
    exit;
}

echo json_encode(['status' => 'created', 'account' => $account]);
