<?php
// Admin-only endpoint: updates an existing client row in place — every
// field except the account number itself (the lookup key; changing it
// would mean a rename, not an update). Called from admin.html's "Existing
// Clients" edit panel.

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
$status = ($input['status'] ?? '') === 'active' ? 'active' : 'pending_payment';

if ($code === '' || $service === '' || $price === '' || $paymentUrl === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
    exit;
}

try {
    $pdo = get_db();

    $current = $pdo->prepare('SELECT status, activated_at FROM clients WHERE account_number = :account');
    $current->execute(['account' => $account]);
    $existing = $current->fetch();

    if (!$existing) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'No client with that account number']);
        exit;
    }

    // Newly flipped to active by hand -> stamp it now. Already active ->
    // keep the original timestamp. Set back to pending -> clear it.
    if ($status === 'active') {
        $activatedAt = $existing['status'] === 'active' ? $existing['activated_at'] : date('Y-m-d H:i:s');
    } else {
        $activatedAt = null;
    }

    $stmt = $pdo->prepare(
        'UPDATE clients SET
            activation_code = :code,
            title = :title,
            service = :service,
            price = :price,
            preview = :preview,
            preview_image_url = :preview_image_url,
            preview_file_url = :preview_file_url,
            deliverable_file_url = :deliverable_file_url,
            payment_url = :payment_url,
            live_url = :live_url,
            status = :status,
            activated_at = :activated_at
         WHERE account_number = :account'
    );
    $stmt->execute([
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
        'status' => $status,
        'activated_at' => $activatedAt,
        'account' => $account,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
    exit;
}

echo json_encode(['status' => 'updated', 'account' => $account]);
