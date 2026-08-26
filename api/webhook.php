<?php
// Stripe webhook endpoint. Configure this URL (https://yourdomain.com/api/webhook.php)
// in Stripe Dashboard → Developers → Webhooks, subscribed to the
// "checkout.session.completed" event.
//
// Verifies Stripe's signature manually (no Stripe SDK/Composer needed —
// InfinityFree doesn't give you shell access to install one). See
// https://stripe.com/docs/webhooks/signatures for the algorithm this
// implements.

require_once __DIR__ . '/db.php';

$payload = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

if (!verify_stripe_signature($payload, $sigHeader, STRIPE_WEBHOOK_SECRET)) {
    http_response_code(400);
    echo 'Invalid signature';
    exit;
}

$event = json_decode($payload, true);

if (($event['type'] ?? '') === 'checkout.session.completed') {
    $session = $event['data']['object'] ?? [];
    // client_reference_id is set automatically by Stripe when the payment
    // link/checkout URL is visited with ?client_reference_id=THEIR_ACCOUNT
    // appended — see admin.js, which builds that URL for you.
    $accountNumber = strtoupper(trim((string) ($session['client_reference_id'] ?? '')));

    if ($accountNumber !== '') {
        try {
            $pdo = get_db();
            $stmt = $pdo->prepare(
                "UPDATE clients SET status = 'active', activated_at = NOW() WHERE account_number = :account"
            );
            $stmt->execute(['account' => $accountNumber]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo 'Database error';
            exit;
        }
    }
}

http_response_code(200);
echo 'ok';

/**
 * Verifies a Stripe webhook signature without the Stripe SDK.
 * https://stripe.com/docs/webhooks/signatures
 */
function verify_stripe_signature(string $payload, string $sigHeader, string $secret): bool
{
    if ($sigHeader === '' || $secret === '') {
        return false;
    }

    $parts = [];
    foreach (explode(',', $sigHeader) as $pair) {
        [$key, $value] = array_pad(explode('=', $pair, 2), 2, null);
        if ($key !== null) {
            $parts[$key][] = $value;
        }
    }

    $timestamp = $parts['t'][0] ?? null;
    $signatures = $parts['v1'] ?? [];

    if ($timestamp === null || empty($signatures)) {
        return false;
    }

    // Reject events older than 5 minutes to guard against replay attacks.
    if (abs(time() - (int) $timestamp) > 300) {
        return false;
    }

    $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);

    foreach ($signatures as $signature) {
        if (hash_equals($expected, (string) $signature)) {
            return true;
        }
    }

    return false;
}
