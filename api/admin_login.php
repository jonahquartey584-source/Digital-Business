<?php
// Admin login: exchanges an email + password + the answer to a personal
// security question for a short-lived session token. admin.html gates the
// New Client Setup tool behind this — log in once, then the tool attaches
// the returned token as `Authorization: Bearer <token>` to every
// create-client/upload call instead of asking for a password on each one.
//
// All three factors are checked before reporting anything, and the error
// never says which one was wrong — just "wrong email, password, or answer"
// either way, so a wrong guess can't be used to narrow down which factor
// failed. Netlify equivalent: netlify/functions/admin-login.mts.

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/admin_auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

function normalize(string $value): string
{
    return strtolower(trim($value));
}

if (
    !defined('ADMIN_EMAIL') || ADMIN_EMAIL === ''
    || !defined('ADMIN_PASSWORD') || ADMIN_PASSWORD === ''
    || !defined('ADMIN_SECURITY_ANSWER') || ADMIN_SECURITY_ANSWER === ''
    || !defined('ADMIN_SESSION_SECRET') || ADMIN_SESSION_SECRET === ''
) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => "Admin login isn't configured yet — set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SECURITY_ANSWER and ADMIN_SESSION_SECRET in config.php",
    ]);
    exit;
}

$emailOk = hash_equals(normalize(ADMIN_EMAIL), normalize((string) ($input['email'] ?? '')));
$passwordOk = hash_equals(ADMIN_PASSWORD, (string) ($input['password'] ?? ''));
$answerOk = hash_equals(normalize(ADMIN_SECURITY_ANSWER), normalize((string) ($input['securityAnswer'] ?? '')));

if (!$emailOk || !$passwordOk || !$answerOk) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Wrong email, password, or answer']);
    exit;
}

echo json_encode(['status' => 'ok', 'token' => create_session_token(ADMIN_SESSION_SECRET)]);
