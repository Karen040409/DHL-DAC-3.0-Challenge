-- Run against MySQL 8.x: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS dhl_kb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dhl_kb;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'editor') NOT NULL DEFAULT 'editor',
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL,
  summary TEXT NULL,
  content MEDIUMTEXT NULL,
  status ENUM('Draft', 'Reviewed', 'Published') NOT NULL DEFAULT 'Draft',
  creator_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_articles_status (status),
  KEY idx_articles_creator (creator_id),
  KEY idx_articles_updated (updated_at),
  CONSTRAINT fk_articles_creator
    FOREIGN KEY (creator_id) REFERENCES users (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Article ↔ Tag (many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS article_tags (
  article_id INT UNSIGNED NOT NULL,
  tag_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  KEY idx_article_tags_tag (tag_id),
  CONSTRAINT fk_article_tags_article
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_article_tags_tag
    FOREIGN KEY (tag_id) REFERENCES tags (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Article status history (Draft → Reviewed → Published audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS article_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id INT UNSIGNED NOT NULL,
  from_status ENUM('Draft', 'Reviewed', 'Published') NULL,
  to_status ENUM('Draft', 'Reviewed', 'Published') NOT NULL,
  actor_user_id INT UNSIGNED NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hist_article (article_id),
  KEY idx_hist_changed (changed_at),
  CONSTRAINT fk_hist_article
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_hist_actor
    FOREIGN KEY (actor_user_id) REFERENCES users (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Processing log (RPA 14-day duplicate window)
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
-- File attachments (PDF/DOCX/screenshots uploaded by editors or RPA)
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
