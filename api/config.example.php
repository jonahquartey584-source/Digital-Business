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
// Required to create new client accounts via admin.html / api/create_client.php.
// Change this to a real password before you rely on this.
define('ADMIN_PASSWORD', 'change-me');

// ---------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------
// Dashboard → Developers → Webhooks → your endpoint → Signing secret.
define('STRIPE_WEBHOOK_SECRET', 'whsec_...');
