<?php
// Admin-only endpoint: accepts an uploaded image (multipart/form-data) for
// a client's preview thumbnail, saves it into /uploads, and returns the
// URL to use as previewImageUrl. Called from admin.html when you choose a
// file under "Preview image". Restricted to real image types — this gets
// rendered in an <img> tag, so anything else wouldn't display anyway. (For
// a non-image "preview file" — e.g. an HTML prototype — see
// api/upload_preview_file.php instead.)

require_once __DIR__ . '/upload_helpers.php';

$extensionsByMime = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp',
];

// Cap well below typical shared-hosting upload_max_filesize (5MB) so we
// give a clear error instead of relying on PHP's ini setting alone. The
// real type is checked from the file's actual contents (via finfo), not
// its filename or the browser-supplied MIME header, both of which are
// easy to fake.
handle_admin_upload(
    fn(string $mimeType, string $originalName): ?string => $extensionsByMime[$mimeType] ?? null,
    5 * 1024 * 1024
);
