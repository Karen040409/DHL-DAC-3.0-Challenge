-- RPA support tables (Scenario 1: 14-day duplicate window + file attachments).
-- Run after schema.sql + 002_article_status_history.sql:
-- mysql -u root -p dhl_kb < database/migrations/003_ingestion_and_attachments.sql

USE dhl_kb;

-- ---------------------------------------------------------------------------
-- Processing log: every file the bot considers gets a row here so the next
-- run can check whether the same content_hash was seen in the last 14 days.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_hash CHAR(64) NOT NULL,
  source_path VARCHAR(500) NULL,
  source_kind VARCHAR(40) NOT NULL DEFAULT 'rpa',
  outcome ENUM('created', 'duplicate', 'failed', 'updated') NOT NULL,
  article_id INT UNSIGNED NULL,
  message VARCHAR(500) NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_proc_hash (content_hash),
  KEY idx_proc_when (processed_at),
  CONSTRAINT fk_proc_article
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- File attachments stored on disk (backend/uploads/), metadata in DB.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS article_attachments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id INT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NULL,
  size_bytes INT UNSIGNED NOT NULL DEFAULT 0,
  content_hash CHAR(64) NULL,
  uploaded_by INT UNSIGNED NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_att_article (article_id),
  CONSTRAINT fk_att_article
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_att_user
    FOREIGN KEY (uploaded_by) REFERENCES users (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;
