<?php
// Copy this file to config.php (same folder) and fill in your real values.
// config.php is gitignored — never commit real credentials to the repo.

// Don't leak errors (which can include secrets) to visitors in production.
ini_set('display_errors', '0');
error_reporting(E_ALL);

// ---------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------
// From your InfinityFree control panel → MySQL Databases. The hostname
// is usually something like "sqlXXX.infinityfree.com", not "localhost".
define('DB_HOST', 'sqlXXX.infinityfree.com');
define('DB_NAME', 'if0_XXXXXXXX_qpdigital');
define('DB_USER', 'if0_XXXXXXXX');
define('DB_PASS', 'your-database-password');

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
// admin.html logs in with all three of these before it'll let you create
// new client accounts or upload previews — see api/admin_login.php. Change
// every one of these to real values before you rely on this.
define('ADMIN_EMAIL', 'you@example.com');
define('ADMIN_PASSWORD', 'change-me');
// The question itself is set in admin.html/admin.js (SECURITY_QUESTION) —
// only the answer needs to live here, and it's matched case-insensitively.
define('ADMIN_SECURITY_ANSWER', 'change-me');
// A long random string used only to sign session tokens — not something
// you type in, just something that needs to exist and stay secret. Any
// random 32+ character string works, e.g. generate one with
// `php -r "echo bin2hex(random_bytes(32));"`.
define('ADMIN_SESSION_SECRET', 'change-me-to-a-long-random-string');

// ---------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------
// Dashboard → Developers → Webhooks → your endpoint → Signing secret.
define('STRIPE_WEBHOOK_SECRET', 'whsec_...');
