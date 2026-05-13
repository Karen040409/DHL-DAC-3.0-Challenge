-- Status change audit trail (Scenario 1 versioning). Run after schema.sql:
-- mysql -u root -p dhl_kb < database/migrations/002_article_status_history.sql

USE dhl_kb;

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
