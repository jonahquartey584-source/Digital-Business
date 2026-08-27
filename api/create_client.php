<?php
// Admin-only endpoint: creates a new client row (account number, code,
// service, price, preview text/image, an optional final deliverable file,
// payment link). Called from admin.html's "Save to Database" button.
// Requires a valid admin session (see admin_login.php / admin_auth.php) —
// admin.html gets one by logging in with the email/password/security
// answer first.

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
$code = strtoupper(trim((string) ($input['code'] ?? '')));
$title = trim((string) ($input['title'] ?? ''));
$service = trim((string) ($input['service'] ?? ''));
$price = trim((string) ($input['price'] ?? ''));
$preview = trim((string) ($input['preview'] ?? ''));
$previewImageUrl = trim((string) ($input['previewImageUrl'] ?? ''));
$previewFileUrl = trim((string) ($input['previewFileUrl'] ?? ''));
$deliverableFileUrl = trim((string) ($input['deliverableFileUrl'] ?? ''));
$paymentUrl = trim((string) ($input['paymentUrl'] ?? ''));
$liveUrl = trim((string) ($input['liveUrl'] ?? ''));
$clientEmail = trim((string) ($input['clientEmail'] ?? ''));

if ($account === '' || $code === '' || $service === '' || $price === '' || $paymentUrl === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
    exit;
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare(
        "INSERT INTO clients (account_number, activation_code, title, service, price, preview, preview_image_url, preview_file_url, deliverable_file_url, payment_url, live_url, client_email, status)
         VALUES (:account, :code, :title, :service, :price, :preview, :preview_image_url, :preview_file_url, :deliverable_file_url, :payment_url, :live_url, :client_email, 'pending_payment')"
    );
    $stmt->execute([
        'account' => $account,
        'code' => $code,
        'title' => $title !== '' ? $title : null,
        'service' => $service,
        'price' => $price,
        'preview' => $preview,
        'preview_image_url' => $previewImageUrl !== '' ? $previewImageUrl : null,
        'preview_file_url' => $previewFileUrl !== '' ? $previewFileUrl : null,
        'deliverable_file_url' => $deliverableFileUrl !== '' ? $deliverableFileUrl : null,
        'payment_url' => $paymentUrl,
        'live_url' => $liveUrl !== '' ? $liveUrl : null,
        'client_email' => $clientEmail !== '' ? $clientEmail : null,
    ]);
} catch (PDOException $e) {
    // Most likely cause: account_number already exists (UNIQUE constraint).
    http_response_code(409);
    echo json_encode(['status' => 'error', 'message' => 'That account number already exists — try again to generate a new one']);
    exit;
}

echo json_encode(['status' => 'created', 'account' => $account]);
