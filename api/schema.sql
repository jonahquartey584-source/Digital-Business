-- Run this once against your InfinityFree MySQL database (via phpMyAdmin,
-- in the InfinityFree control panel) before using the API.

CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_number VARCHAR(32) NOT NULL UNIQUE,
  activation_code VARCHAR(32) NOT NULL,
  service VARCHAR(255) NOT NULL,
  price VARCHAR(64) NOT NULL,
  preview TEXT,
  payment_url VARCHAR(500) NOT NULL,
  live_url VARCHAR(500) NULL,
  status ENUM('pending_payment', 'active') NOT NULL DEFAULT 'pending_payment',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
