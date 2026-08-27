<?php
// Admin-only endpoint: emails a client their account number, activation
// code, and the redeem link — the same content admin.html's "Message To
// Send The Client" box already generates for copy-pasting, just sent
// automatically instead. Called by the "Email Account & Code to Client"
// button that appears once a client has a clientEmail set (right after
// saving, or later from the Existing Clients edit panel).

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admin_auth.php';
require_once __DIR__ . '/email.php';

header('Content-Type: application/json');

const BUSINESS_NAME = 'Qp Digital';
// Keep in sync with REDEEM_URL at the top of admin.js.
const REDEEM_URL = 'https://qp-digital.netlify.app/activate.html';

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
    $stmt = $pdo->prepare(
        'SELECT account_number, activation_code, service, price, client_email FROM clients WHERE account_number = :account'
    );
    $stmt->execute(['account' => $account]);
    $client = $stmt->fetch();
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
    exit;
}

if (!$client) {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'message' => 'No client with that account number']);
    exit;
}

if (!$client['client_email']) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No email set for this client']);
    exit;
}

$text = implode("\n", [
    "Hi! Your {$client['service']} with " . BUSINESS_NAME . ' is ready.',
    '',
    'Go to ' . REDEEM_URL . ' and enter:',
    "Account Number: {$client['account_number']}",
    "Activation Code: {$client['activation_code']}",
    '',
    "Price: {$client['price']}",
    '',
    'Once you pay, it activates automatically.',
]);

$html = '
    <div style="font-family:sans-serif;color:#222;line-height:1.6;">
      <p>Hi! Your <strong>' . htmlspecialchars($client['service']) . '</strong> with ' . BUSINESS_NAME . ' is ready.</p>
      <p>Go to <a href="' . REDEEM_URL . '">' . REDEEM_URL . '</a> and enter:</p>
      <table style="border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Account Number</td><td><strong>' . htmlspecialchars($client['account_number']) . '</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Activation Code</td><td><strong>' . htmlspecialchars($client['activation_code']) . '</strong></td></tr>
      </table>
      <p style="margin-top:16px;">Price: <strong>' . htmlspecialchars($client['price']) . '</strong></p>
      <p>Once you pay, it activates automatically.</p>
    </div>
';

$sent = send_email(
    $client['client_email'],
    "Your {$client['service']} is ready — " . BUSINESS_NAME,
    $html,
    $text
);

if (!$sent) {
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => "Couldn't send the email — is RESEND_API_KEY set?"]);
    exit;
}

echo json_encode(['status' => 'ok']);
