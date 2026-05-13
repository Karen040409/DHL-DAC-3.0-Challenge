-- Run after schema.sql:
--   mysql -u root -p dhl_kb < database/seed.sql
-- Idempotent: re-runnable without errors or duplicates.

USE dhl_kb;

-- ---------------------------------------------------------------------------
-- Tags (names are unique; INSERT IGNORE is idempotent)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO tags (name) VALUES
  ('Logistics'),
  ('SOP'),
  ('Dock Operations'),
  ('Teams Export'),
  ('Customs'),
  ('Billing'),
  ('SLA'),
  ('Email Thread'),
  ('Screenshot'),
  ('Fleet'),
  ('Carrier'),
  ('PDF Source');

-- ---------------------------------------------------------------------------
-- Users (username unique; INSERT IGNORE keeps existing rows unchanged)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO users (username, password_hash, role) VALUES
  ('admin_karen', '$2b$10$placeholder.demo.seed.hash.value.aaaaaaaaaaaaaaaaaaaaaaaaa', 'admin'),
  ('ops.editor', '$2b$10$placeholder.demo.seed.hash.value.aaaaaaaaaaaaaaaaaaaaaaaaa', 'editor'),
  ('ops.reviewer', '$2b$10$placeholder.demo.seed.hash.value.aaaaaaaaaaaaaaaaaaaaaaaaa', 'editor'),
  ('bot.rpa', '$2b$10$placeholder.demo.seed.hash.value.aaaaaaaaaaaaaaaaaaaaaaaaa', 'editor');

-- ---------------------------------------------------------------------------
-- Articles (gated by exact title so re-runs do not duplicate)
-- ---------------------------------------------------------------------------
INSERT INTO articles (title, summary, content, status, creator_id, created_at, updated_at)
SELECT
  'SOP-001: Inbound pallet seal verification at dock door',
  'Step-by-step verification of tamper-evident seals and load documentation before accepting inbound pallets at the dock.',
  'Scope covers dock doors 1–12 during inbound peak. Operators must photograph the seal ID, match it to the ASN, and escalate mismatches to the shift lead within 15 minutes. Exceptions are logged in the dock tablet workflow.',
  'Published',
  (SELECT id FROM users WHERE username = 'admin_karen' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL 28 DAY),
  DATE_SUB(NOW(), INTERVAL 25 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE title = 'SOP-001: Inbound pallet seal verification at dock door' LIMIT 1);

INSERT INTO articles (title, summary, content, status, creator_id, created_at, updated_at)
SELECT
  'SOP-002: HS / HTS code dispute resolution',
  'Playbook for reconciling customs classification disagreements between broker filings and customer commercial invoices.',
  'When HS/HTS variance exceeds one subheading, pause release and attach broker correspondence, invoice line items, and prior accepted entries. Route to the trade compliance queue with a 48-hour internal review target.',
  'Published',
  (SELECT id FROM users WHERE username = 'ops.editor' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL 23 DAY),
  DATE_SUB(NOW(), INTERVAL 20 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE title = 'SOP-002: HS / HTS code dispute resolution' LIMIT 1);

INSERT INTO articles (title, summary, content, status, creator_id, created_at, updated_at)
SELECT
  'SOP-003: Invoice dispute escalation > 5%',
  'Threshold-based escalation for invoice variances above five percent versus contracted lane rates or accessorial caps.',
  'Capture billed weight, dim divisor used, fuel index date, and accessorial codes. If the delta remains above five percent after first-pass billing review, open a dispute ticket with finance and attach the signed rate card snapshot.',
  'Published',
  (SELECT id FROM users WHERE username = 'ops.reviewer' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL 17 DAY),
  DATE_SUB(NOW(), INTERVAL 14 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE title = 'SOP-003: Invoice dispute escalation > 5%' LIMIT 1);

INSERT INTO articles (title, summary, content, status, creator_id, created_at, updated_at)
SELECT
  'Procedure: SLA breach notification flow',
  'Customer-facing notification cadence when an SLA clock is at risk or has breached, including owner roles and templates.',
  'T minus six hours: notify account owner and operations bridge. At breach: send structured summary with root-cause bucket, recovery ETA, and goodwill policy reference. Archive the email thread ID on the case record.',
  'Reviewed',
  (SELECT id FROM users WHERE username = 'ops.editor' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL 12 DAY),
  DATE_SUB(NOW(), INTERVAL 10 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE title = 'Procedure: SLA breach notification flow' LIMIT 1);

INSERT INTO articles (title, summary, content, status, creator_id, created_at, updated_at)
SELECT
  'Driver handover checklist (peak season)',
  'Checklist for trailer handover between linehaul and last-mile teams during surge weeks, including seal continuity checks.',
  'Verify trailer number, seal continuity, temperature set-point (if reefer), and exception tags from the yard camera audit. The receiving driver initials the tablet handover screen before departure.',
  'Reviewed',
  (SELECT id FROM users WHERE username = 'admin_karen' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL 9 DAY),
  DATE_SUB(NOW(), INTERVAL 7 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE title = 'Driver handover checklist (peak season)' LIMIT 1);

INSERT INTO articles (title, summary, content, status, creator_id, created_at, updated_at)
SELECT
  'Carrier rate card refresh — ABC Lines Q2',
  'Internal memo on updating lane-level minimums and detention rules following the Q2 rate card refresh from ABC Lines.',
  'Replace Appendix C tables for Midwest lanes, add new detention free time for weekend holds, and note fuel surcharge alignment to the weekly index published each Monday.',
  'Reviewed',
  (SELECT id FROM users WHERE username = 'ops.reviewer' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL 6 DAY),
  DATE_SUB(NOW(), INTERVAL 4 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE title = 'Carrier rate card refresh — ABC Lines Q2' LIMIT 1);

INSERT INTO articles (title, summary, content, status, creator_id, created_at, updated_at)
SELECT
  'Draft: Teams thread cleanup — dock incident 2026-04-12',
  'Auto-captured Teams thread (RPA) summarizing dock door congestion and temporary staging overflow on 2026-04-12.',
  'Thread highlights: hold on doors 7–9, reroute to overflow strip, photos in channel ''dock-ops-alerts''. Pending human edit to confirm final disposition codes before publish.',
  'Draft',
  (SELECT id FROM users WHERE username = 'bot.rpa' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL 5 DAY),
  DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE title = 'Draft: Teams thread cleanup — dock incident 2026-04-12' LIMIT 1);

INSERT INTO articles (title, summary, content, status, creator_id, created_at, updated_at)
SELECT
  'Draft: customs broker email — shipment SHP-44021',
  'Broker email thread draft for SHP-44021 covering missing commercial invoice page 2 and revised HS subheading.',
  'Awaiting broker PDF attachment and customer confirmation on value declaration. RPA staged content only; do not release externally until reviewed.',
  'Draft',
  (SELECT id FROM users WHERE username = 'bot.rpa' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL 4 DAY),
  DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE title = 'Draft: customs broker email — shipment SHP-44021' LIMIT 1);

-- ---------------------------------------------------------------------------
-- Article tags (composite PK; INSERT IGNORE skips existing pairs)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, (SELECT id FROM tags WHERE name = 'SOP' LIMIT 1) FROM articles a WHERE a.title = 'SOP-001: Inbound pallet seal verification at dock door'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Dock Operations' LIMIT 1) FROM articles a WHERE a.title = 'SOP-001: Inbound pallet seal verification at dock door'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Logistics' LIMIT 1) FROM articles a WHERE a.title = 'SOP-001: Inbound pallet seal verification at dock door';

INSERT IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, (SELECT id FROM tags WHERE name = 'SOP' LIMIT 1) FROM articles a WHERE a.title = 'SOP-002: HS / HTS code dispute resolution'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Customs' LIMIT 1) FROM articles a WHERE a.title = 'SOP-002: HS / HTS code dispute resolution';

INSERT IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, (SELECT id FROM tags WHERE name = 'SOP' LIMIT 1) FROM articles a WHERE a.title = 'SOP-003: Invoice dispute escalation > 5%'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Billing' LIMIT 1) FROM articles a WHERE a.title = 'SOP-003: Invoice dispute escalation > 5%'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'SLA' LIMIT 1) FROM articles a WHERE a.title = 'SOP-003: Invoice dispute escalation > 5%';

INSERT IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, (SELECT id FROM tags WHERE name = 'SLA' LIMIT 1) FROM articles a WHERE a.title = 'Procedure: SLA breach notification flow'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Email Thread' LIMIT 1) FROM articles a WHERE a.title = 'Procedure: SLA breach notification flow';

INSERT IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, (SELECT id FROM tags WHERE name = 'Fleet' LIMIT 1) FROM articles a WHERE a.title = 'Driver handover checklist (peak season)'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'SOP' LIMIT 1) FROM articles a WHERE a.title = 'Driver handover checklist (peak season)'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Logistics' LIMIT 1) FROM articles a WHERE a.title = 'Driver handover checklist (peak season)';

INSERT IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, (SELECT id FROM tags WHERE name = 'Carrier' LIMIT 1) FROM articles a WHERE a.title = 'Carrier rate card refresh — ABC Lines Q2'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Billing' LIMIT 1) FROM articles a WHERE a.title = 'Carrier rate card refresh — ABC Lines Q2';

INSERT IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, (SELECT id FROM tags WHERE name = 'Teams Export' LIMIT 1) FROM articles a WHERE a.title = 'Draft: Teams thread cleanup — dock incident 2026-04-12'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Dock Operations' LIMIT 1) FROM articles a WHERE a.title = 'Draft: Teams thread cleanup — dock incident 2026-04-12';

INSERT IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, (SELECT id FROM tags WHERE name = 'Email Thread' LIMIT 1) FROM articles a WHERE a.title = 'Draft: customs broker email — shipment SHP-44021'
UNION ALL SELECT a.id, (SELECT id FROM tags WHERE name = 'Customs' LIMIT 1) FROM articles a WHERE a.title = 'Draft: customs broker email — shipment SHP-44021';

-- ---------------------------------------------------------------------------
-- Status history (per article; each row gated with NOT EXISTS)
-- ---------------------------------------------------------------------------
-- SOP-001 Published
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, NULL, 'Draft', (SELECT id FROM users WHERE username = 'admin_karen' LIMIT 1), DATE_SUB(NOW(), INTERVAL 28 DAY)
FROM articles a
WHERE a.title = 'SOP-001: Inbound pallet seal verification at dock door'
  AND NOT EXISTS (
    SELECT 1 FROM article_status_history h
    WHERE h.article_id = a.id AND h.from_status IS NULL AND h.to_status = 'Draft'
    LIMIT 1
  );
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Draft', 'Reviewed', (SELECT id FROM users WHERE username = 'ops.editor' LIMIT 1), DATE_SUB(NOW(), INTERVAL 26 DAY)
FROM articles a
WHERE a.title = 'SOP-001: Inbound pallet seal verification at dock door'
  AND NOT EXISTS (
    SELECT 1 FROM article_status_history h
    WHERE h.article_id = a.id AND h.from_status = 'Draft' AND h.to_status = 'Reviewed'
    LIMIT 1
  );
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Reviewed', 'Published', (SELECT id FROM users WHERE username = 'ops.reviewer' LIMIT 1), DATE_SUB(NOW(), INTERVAL 25 DAY)
FROM articles a
WHERE a.title = 'SOP-001: Inbound pallet seal verification at dock door'
  AND NOT EXISTS (
    SELECT 1 FROM article_status_history h
    WHERE h.article_id = a.id AND h.from_status = 'Reviewed' AND h.to_status = 'Published'
    LIMIT 1
  );

-- SOP-002 Published
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, NULL, 'Draft', (SELECT id FROM users WHERE username = 'ops.editor' LIMIT 1), DATE_SUB(NOW(), INTERVAL 23 DAY)
FROM articles a
WHERE a.title = 'SOP-002: HS / HTS code dispute resolution'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status IS NULL AND h.to_status = 'Draft' LIMIT 1);
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Draft', 'Reviewed', (SELECT id FROM users WHERE username = 'admin_karen' LIMIT 1), DATE_SUB(NOW(), INTERVAL 22 DAY)
FROM articles a
WHERE a.title = 'SOP-002: HS / HTS code dispute resolution'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status = 'Draft' AND h.to_status = 'Reviewed' LIMIT 1);
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Reviewed', 'Published', (SELECT id FROM users WHERE username = 'ops.reviewer' LIMIT 1), DATE_SUB(NOW(), INTERVAL 20 DAY)
FROM articles a
WHERE a.title = 'SOP-002: HS / HTS code dispute resolution'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status = 'Reviewed' AND h.to_status = 'Published' LIMIT 1);

-- SOP-003 Published
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, NULL, 'Draft', (SELECT id FROM users WHERE username = 'ops.reviewer' LIMIT 1), DATE_SUB(NOW(), INTERVAL 17 DAY)
FROM articles a
WHERE a.title = 'SOP-003: Invoice dispute escalation > 5%'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status IS NULL AND h.to_status = 'Draft' LIMIT 1);
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Draft', 'Reviewed', (SELECT id FROM users WHERE username = 'ops.editor' LIMIT 1), DATE_SUB(NOW(), INTERVAL 16 DAY)
FROM articles a
WHERE a.title = 'SOP-003: Invoice dispute escalation > 5%'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status = 'Draft' AND h.to_status = 'Reviewed' LIMIT 1);
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Reviewed', 'Published', (SELECT id FROM users WHERE username = 'admin_karen' LIMIT 1), DATE_SUB(NOW(), INTERVAL 14 DAY)
FROM articles a
WHERE a.title = 'SOP-003: Invoice dispute escalation > 5%'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status = 'Reviewed' AND h.to_status = 'Published' LIMIT 1);

-- Procedure: SLA breach (Reviewed)
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, NULL, 'Draft', (SELECT id FROM users WHERE username = 'ops.editor' LIMIT 1), DATE_SUB(NOW(), INTERVAL 12 DAY)
FROM articles a
WHERE a.title = 'Procedure: SLA breach notification flow'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status IS NULL AND h.to_status = 'Draft' LIMIT 1);
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Draft', 'Reviewed', (SELECT id FROM users WHERE username = 'ops.reviewer' LIMIT 1), DATE_SUB(NOW(), INTERVAL 10 DAY)
FROM articles a
WHERE a.title = 'Procedure: SLA breach notification flow'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status = 'Draft' AND h.to_status = 'Reviewed' LIMIT 1);

-- Driver handover (Reviewed)
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, NULL, 'Draft', (SELECT id FROM users WHERE username = 'admin_karen' LIMIT 1), DATE_SUB(NOW(), INTERVAL 9 DAY)
FROM articles a
WHERE a.title = 'Driver handover checklist (peak season)'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status IS NULL AND h.to_status = 'Draft' LIMIT 1);
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Draft', 'Reviewed', (SELECT id FROM users WHERE username = 'ops.editor' LIMIT 1), DATE_SUB(NOW(), INTERVAL 7 DAY)
FROM articles a
WHERE a.title = 'Driver handover checklist (peak season)'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status = 'Draft' AND h.to_status = 'Reviewed' LIMIT 1);

-- Carrier rate card (Reviewed)
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, NULL, 'Draft', (SELECT id FROM users WHERE username = 'ops.reviewer' LIMIT 1), DATE_SUB(NOW(), INTERVAL 6 DAY)
FROM articles a
WHERE a.title = 'Carrier rate card refresh — ABC Lines Q2'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status IS NULL AND h.to_status = 'Draft' LIMIT 1);
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, 'Draft', 'Reviewed', (SELECT id FROM users WHERE username = 'admin_karen' LIMIT 1), DATE_SUB(NOW(), INTERVAL 4 DAY)
FROM articles a
WHERE a.title = 'Carrier rate card refresh — ABC Lines Q2'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status = 'Draft' AND h.to_status = 'Reviewed' LIMIT 1);

-- Teams draft (Draft)
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, NULL, 'Draft', (SELECT id FROM users WHERE username = 'bot.rpa' LIMIT 1), DATE_SUB(NOW(), INTERVAL 5 DAY)
FROM articles a
WHERE a.title = 'Draft: Teams thread cleanup — dock incident 2026-04-12'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status IS NULL AND h.to_status = 'Draft' LIMIT 1);

-- Customs broker draft (Draft)
INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id, changed_at)
SELECT a.id, NULL, 'Draft', (SELECT id FROM users WHERE username = 'bot.rpa' LIMIT 1), DATE_SUB(NOW(), INTERVAL 4 DAY)
FROM articles a
WHERE a.title = 'Draft: customs broker email — shipment SHP-44021'
  AND NOT EXISTS (SELECT 1 FROM article_status_history h WHERE h.article_id = a.id AND h.from_status IS NULL AND h.to_status = 'Draft' LIMIT 1);

-- ---------------------------------------------------------------------------
-- Processing log (demo rows for /api/ingestion/recent)
-- ---------------------------------------------------------------------------
INSERT INTO processing_log (content_hash, source_path, source_kind, outcome, article_id, message, processed_at)
SELECT
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '/ingest/teams/dock-incident-2026-04-12.json',
  'rpa',
  'created',
  (SELECT id FROM articles WHERE title = 'Draft: Teams thread cleanup — dock incident 2026-04-12' LIMIT 1),
  'Teams export normalized and article stub created.',
  DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (
  SELECT 1 FROM processing_log pl
  WHERE pl.content_hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    AND pl.outcome = 'created'
  LIMIT 1
);

INSERT INTO processing_log (content_hash, source_path, source_kind, outcome, article_id, message, processed_at)
SELECT
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '/ingest/email/shp-99211.msg',
  'rpa',
  'duplicate',
  NULL,
  'Duplicate within 14-day hash window; skipped insert.',
  DATE_SUB(NOW(), INTERVAL 3 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (
  SELECT 1 FROM processing_log pl
  WHERE pl.content_hash = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    AND pl.outcome = 'duplicate'
  LIMIT 1
);

INSERT INTO processing_log (content_hash, source_path, source_kind, outcome, article_id, message, processed_at)
SELECT
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  '/ingest/pdf/broker-pack-scan.pdf',
  'rpa',
  'failed',
  NULL,
  'Parser error: encrypted PDF or missing text layer (exit code 22).',
  DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM (SELECT 1) AS _
WHERE NOT EXISTS (
  SELECT 1 FROM processing_log pl
  WHERE pl.content_hash = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    AND pl.outcome = 'failed'
  LIMIT 1
);

-- ---------------------------------------------------------------------------
-- Summary (first successful run targets; re-runs add 0 rows via guards)
-- ---------------------------------------------------------------------------
-- tags: up to 12 rows (4 legacy + 8 new) via INSERT IGNORE
-- users: up to 4 rows via INSERT IGNORE
-- articles: up to 8 rows (title-gated INSERT … SELECT)
-- article_tags: up to 19 link rows via INSERT IGNORE on composite PK
-- article_status_history: up to 17 audit rows (NULL→Draft on all 8, +9 transitions for Reviewed/Published)
-- processing_log: up to 3 rows (hash+outcome gated)
