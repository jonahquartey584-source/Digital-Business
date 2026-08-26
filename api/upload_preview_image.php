<?php
// Admin-only endpoint: accepts an uploaded image file (multipart/form-data)
// for a client's preview, saves it into /uploads, and returns the URL to
// use as previewImageUrl. Called from admin.html when you choose a file
// under "Preview image".

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/config.php';

if (!hash_equals(ADMIN_PASSWORD, (string) ($_POST['adminPassword'] ?? ''))) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Wrong admin password']);
    exit;
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No image was uploaded']);
    exit;
}

$file = $_FILES['image'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    $message = $file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE
        ? 'That image is too large'
        : 'Upload failed — try again';
    echo json_encode(['status' => 'error', 'message' => $message]);
    exit;
}

// Cap well below typical shared-hosting upload_max_filesize (5MB) so we
// give a clear error instead of relying on PHP's ini setting alone.
const MAX_BYTES = 5 * 1024 * 1024;
if ($file['size'] > MAX_BYTES) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Image is larger than 5MB — resize it and try again']);
    exit;
}

// Identify the real file type from its contents (not the filename or the
// browser-supplied MIME type, both of which are easy to fake) and map it
// to a fixed extension. Anything outside this whitelist is rejected — in
// particular, this is what stops someone uploading a .php file dressed up
// as an image.
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$extensionsByMime = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp',
];

if (!isset($extensionsByMime[$mimeType])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Only JPG, PNG, GIF or WEBP images are allowed']);
    exit;
}

$extension = $extensionsByMime[$mimeType];
$filename = bin2hex(random_bytes(16)) . '.' . $extension;
$uploadsDir = __DIR__ . '/../uploads';

if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0755, true) && !is_dir($uploadsDir)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Uploads folder is missing and could not be created']);
    exit;
}

$destination = $uploadsDir . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => "Couldn't save the uploaded file"]);
    exit;
}

// Relative to the site root — admin.html and activate.html are both
// top-level pages, so this resolves correctly from either.
echo json_encode(['status' => 'uploaded', 'url' => 'uploads/' . $filename]);
