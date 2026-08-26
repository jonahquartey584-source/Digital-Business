<?php
// Shared admin session-token logic — the PHP equivalent of the session
// helpers in netlify/functions/_shared.mts. api/admin_login.php issues a
// token after checking email + password + security-question answer;
// api/create_client.php and the two upload endpoints (via
// api/upload_helpers.php) verify it on every action instead of re-checking
// a password each time.
//
// A token is `<base64url({exp})>.<hmac-sha256 of that, hex>` — no
// server-side session store needed, so a plain stateless PHP script can
// verify one without a database round-trip.

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    return (string) base64_decode(strtr($data, '-_', '+/'));
}

function create_session_token(string $secret): string
{
    $payload = base64url_encode(json_encode(['exp' => time() + SESSION_TTL_SECONDS]));
    $signature = hash_hmac('sha256', $payload, $secret);
    return $payload . '.' . $signature;
}

function verify_session_token(string $token, string $secret): bool
{
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) {
        return false;
    }
    [$payload, $signature] = $parts;

    $expected = hash_hmac('sha256', $payload, $secret);
    if (!hash_equals($expected, $signature)) {
        return false;
    }

    $decoded = json_decode(base64url_decode($payload), true);
    return is_array($decoded) && isset($decoded['exp']) && (int) $decoded['exp'] > time();
}

// True if the request carries a valid, unexpired admin session token in its
// Authorization header. Used by every admin-only action endpoint in place
// of a per-request password check.
//
// Reads the Authorization header defensively — some Apache/PHP setups
// (InfinityFree included, sometimes) strip it unless forwarded explicitly;
// api/.htaccess forwards it, but this also checks the REDIRECT_ fallback
// some hosts use instead.
function require_admin_session(): bool
{
    require_once __DIR__ . '/config.php';

    if (!defined('ADMIN_SESSION_SECRET') || ADMIN_SESSION_SECRET === '') {
        return false;
    }

    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if (function_exists('getallheaders') && $header === '') {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
                break;
            }
        }
    }

    if (!str_starts_with($header, 'Bearer ')) {
        return false;
    }

    return verify_session_token(substr($header, 7), ADMIN_SESSION_SECRET);
}
