<?php
// Public endpoint: a visitor submitting the homepage's enquiry form lands
// here. Sends them an automatic "we've got it" confirmation email, and
// (best-effort — its failure doesn't affect the visitor's response) a
// notification to the business inbox with the enquiry's details.
//
// Unlike every other endpoint in this codebase, this one is intentionally
// public — anyone can submit an enquiry, that's the point of the form.

require_once __DIR__ . '/email.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$name = trim((string) ($input['name'] ?? ''));
$business = trim((string) ($input['business'] ?? ''));
$address = trim((string) ($input['address'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$phone = trim((string) ($input['phone'] ?? ''));
$service = trim((string) ($input['service'] ?? ''));
$details = trim((string) ($input['details'] ?? ''));
$negotiate = !empty($input['negotiate']);

if ($name === '' || $email === '' || $service === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Name, email and service are required']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => "That email address doesn't look right"]);
    exit;
}

require_once __DIR__ . '/config.php';
$businessInboxEmail = defined('ADMIN_EMAIL') ? ADMIN_EMAIL : '';

$summaryRows = array_filter([
    ['Service', $service],
    $business !== '' ? ['Business', $business] : null,
    $address !== '' ? ['Address', $address] : null,
    $phone !== '' ? ['Phone', $phone] : null,
    ['Open to negotiating price', $negotiate ? 'Yes' : 'No'],
]);

$summaryRowsHtml = implode('', array_map(
    fn($row) => '<tr><td style="padding:4px 12px 4px 0;color:#666;">' . htmlspecialchars($row[0]) . '</td><td>' . htmlspecialchars($row[1]) . '</td></tr>',
    $summaryRows
));

$confirmationHtml = '
    <div style="font-family:sans-serif;color:#222;line-height:1.6;">
      <p>Hi ' . htmlspecialchars($name) . ',</p>
      <p>Thanks for reaching out to <strong>Qp Digital</strong> about <strong>' . htmlspecialchars($service) . '</strong>.
      We\'ve received your enquiry and our team will respond as quickly as possible.</p>
      <p>Here\'s what you sent us:</p>
      <table style="border-collapse:collapse;">' . $summaryRowsHtml . '</table>
      ' . ($details !== '' ? '<p style="margin-top:16px;"><strong>Details:</strong><br>' . nl2br(htmlspecialchars($details)) . '</p>' : '') . '
      <p style="margin-top:16px;">If anything above needs correcting, just reply to this email.</p>
      <p>— Qp Digital</p>
    </div>
';

$confirmationText = implode("\n", array_filter([
    "Hi {$name},",
    '',
    "Thanks for reaching out to Qp Digital about {$service}. We've received your enquiry and our team will respond as quickly as possible.",
    '',
    "Here's what you sent us:",
    "Service: {$service}",
    $business !== '' ? "Business: {$business}" : null,
    $address !== '' ? "Address: {$address}" : null,
    $phone !== '' ? "Phone: {$phone}" : null,
    'Open to negotiating price: ' . ($negotiate ? 'Yes' : 'No'),
    '',
    $details !== '' ? "Details:\n{$details}" : null,
    '',
    'If anything above needs correcting, just reply to this email.',
    '',
    '— Qp Digital',
], fn($line) => $line !== null));

$confirmationSent = send_email(
    $email,
    "We've received your enquiry — Qp Digital",
    $confirmationHtml,
    $confirmationText,
    $businessInboxEmail ?: null
);

// Best-effort: a visitor's confirmation is the important part and is
// already sent above; whether the business's own notification succeeds
// doesn't change what we tell them.
if ($businessInboxEmail !== '') {
    send_email(
        $businessInboxEmail,
        "New enquiry: {$service} from {$name}",
        str_replace('Hi ' . htmlspecialchars($name), 'New enquiry from ' . htmlspecialchars($name) . ' (' . htmlspecialchars($email) . ')', $confirmationHtml),
        str_replace("Hi {$name},", "New enquiry from {$name} ({$email}):", $confirmationText),
        $email
    );
}

echo json_encode(['status' => 'ok', 'emailSent' => $confirmationSent]);
