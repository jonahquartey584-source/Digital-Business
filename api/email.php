<?php
// Shared transactional-email helper — the PHP equivalent of sendEmail() in
// netlify/functions/_shared.mts. Sends via Resend's HTTP API
// (https://resend.com) using cURL (standard on PHP shared hosting,
// InfinityFree included) — no SDK, no SMTP setup, just an API key.
//
// Requires RESEND_API_KEY in config.php. Without it, returns false so
// callers can decide how to degrade — api/enquiry.php still tells the
// visitor their enquiry was submitted either way; email is a nice-to-have
// on top of that, not the only record of it.
//
// The sender address is Resend's own shared onboarding domain — it works
// without owning/verifying a domain, which this site doesn't have yet.
// Swap it for an address on your own verified domain once you have one —
// deliverability is meaningfully better than a shared domain.

const EMAIL_FROM_ADDRESS = 'Qp Digital <onboarding@resend.dev>';

function send_email(string $to, string $subject, string $html, string $text, ?string $replyTo = null): bool
{
    require_once __DIR__ . '/config.php';

    if (!defined('RESEND_API_KEY') || RESEND_API_KEY === '') {
        return false;
    }

    $payload = [
        'from' => EMAIL_FROM_ADDRESS,
        'to' => [$to],
        'subject' => $subject,
        'html' => $html,
        'text' => $text,
    ];
    if ($replyTo !== null && $replyTo !== '') {
        $payload['reply_to'] = $replyTo;
    }

    if (!function_exists('curl_init')) {
        return false;
    }

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . RESEND_API_KEY,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 10,
    ]);
    curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode >= 200 && $httpCode < 300;
}
