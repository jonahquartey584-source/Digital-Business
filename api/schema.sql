-- Run this once against your InfinityFree MySQL database (via phpMyAdmin,
-- in the InfinityFree control panel) before using the API.

CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_number VARCHAR(32) NOT NULL UNIQUE,
  activation_code VARCHAR(32) NOT NULL,
  title VARCHAR(255) NULL,
  service VARCHAR(255) NOT NULL,
  price VARCHAR(64) NOT NULL,
  preview TEXT,
  preview_image_url VARCHAR(500) NULL,
  preview_file_url VARCHAR(500) NULL,
  deliverable_file_url VARCHAR(500) NULL,
  payment_url VARCHAR(500) NOT NULL,
  live_url VARCHAR(500) NULL,
  status ENUM('pending_payment', 'active') NOT NULL DEFAULT 'pending_payment',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Already ran this once against an older version of this file? CREATE
-- TABLE IF NOT EXISTS above is a no-op on an existing table, so run
-- whichever of these you're missing instead:
-- ALTER TABLE clients ADD COLUMN preview_image_url VARCHAR(500) NULL AFTER preview;
-- ALTER TABLE clients ADD COLUMN title VARCHAR(255) NULL AFTER activation_code;
-- ALTER TABLE clients ADD COLUMN preview_file_url VARCHAR(500) NULL AFTER preview_image_url;
-- Renamed from preview_link_url? RENAME COLUMN clients.preview_link_url TO preview_file_url;
-- ALTER TABLE clients ADD COLUMN deliverable_file_url VARCHAR(500) NULL AFTER preview_file_url;
