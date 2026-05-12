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
