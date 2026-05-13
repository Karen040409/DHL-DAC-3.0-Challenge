-- Optional dev seed (run after schema.sql)
-- mysql -u root -p dhl_kb < database/seed.sql

USE dhl_kb;

-- Sample tags for filters / RPA / uploads (idempotent by name)
INSERT IGNORE INTO tags (name) VALUES
  ('Logistics'),
  ('SOP'),
  ('Dock Operations'),
  ('Teams Export');

-- Default admin-style user if none with this username (does not overwrite your DB)
INSERT INTO users (username, password_hash, role)
SELECT 'admin_karen', 'dummy_hash_for_now', 'admin'
FROM (SELECT 1 AS _) AS _
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = 'admin_karen' LIMIT 1);
