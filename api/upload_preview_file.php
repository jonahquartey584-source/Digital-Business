<?php
// Admin-only endpoint: accepts ANY uploaded file (multipart/form-data) to
// use as the "Preview file" — what a client's preview image links to when
// they click it. Deliberately not restricted to images: the point is to
// let you attach an actual HTML prototype of the client's site (or a PDF
// proposal, a design export, whatever's relevant) that opens directly in
// their browser. Saves into /uploads and returns its URL. Called from
// admin.html when you choose a file under "Preview file".
//
// Security note: this endpoint is permissive on file *type* by design —
// including .html, which will render (and run any JS/CSS it contains) if
// opened. That's the intended use (a live-looking prototype), not a bug.
// What it still blocks is anything that could execute as *server-side*
// code — the extensions below, and uploads/.htaccess denies execution of
// those same extensions as a second layer. Both endpoints are gated behind
// ADMIN_PASSWORD, the same trust boundary as FTP/file-manager access to
// this host already gives you — so this doesn't hand out capability an
// admin doesn't already have.

require_once __DIR__ . '/upload_helpers.php';

$blockedExtensions = [
    'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar', 'pht',
    'pl', 'py', 'cgi', 'sh', 'bash', 'asp', 'aspx', 'jsp', 'cer',
    'exe', 'dll', 'com', 'bat', 'msi',
    'htaccess', 'htpasswd', 'ini', 'config',
];

function safe_extension_from_upload_name(string $originalName, array $blockedExtensions): ?string
{
    $extension = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
    $extension = preg_replace('/[^a-z0-9]/', '', $extension) ?? '';
    if ($extension === '' || in_array($extension, $blockedExtensions, true)) {
        return null;
    }
    return $extension;
}

// 15MB — generous enough for an HTML/CSS/image prototype without straining
// typical free-tier shared hosting limits.
handle_admin_upload(
    fn(string $mimeType, string $originalName): ?string => safe_extension_from_upload_name($originalName, $blockedExtensions),
    15 * 1024 * 1024
);
