<?php
// Shared logic for the admin-only upload endpoints (api/upload_preview_image.php,
// api/upload_preview_file.php). Both require the admin password, save the
// uploaded file into /uploads under a random filename, and return
// { status, url } as JSON.
//
// $resolveExtension is called with (finfo-detected MIME type, original
// filename) and must return either a safe lowercase extension string to
// save the file under, or null to reject the upload.

function handle_admin_upload(callable $resolveExtension, int $maxBytes): void
{
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

    if (!isset($_FILES['file']) || $_FILES['file']['error'] === UPLOAD_ERR_NO_FILE) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'No file was uploaded']);
        exit;
    }

    $file = $_FILES['file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        $message = $file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE
            ? 'That file is too large'
            : 'Upload failed — try again';
        echo json_encode(['status' => 'error', 'message' => $message]);
        exit;
    }

    if ($file['size'] > $maxBytes) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'That file is larger than ' . round($maxBytes / (1024 * 1024)) . 'MB']);
        exit;
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    $extension = $resolveExtension($mimeType, (string) $file['name']);

    if ($extension === null) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => "That file type isn't allowed"]);
        exit;
    }

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
}
