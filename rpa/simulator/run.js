/**
 * SmartHub RPA simulator — drives the same Express API contract as the UiPath bot.
 * Requires Node.js 20+ (stable global File / Blob / FormData for multipart).
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

function ttyColor(code, text) {
  if (process.stdout.isTTY) return `${code}${text}${RESET}`;
  return text;
}

function requireNode20Plus() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (Number.isNaN(major) || major < 20) {
    console.error(
      `This simulator requires Node.js 20 or later for built-in File/Blob/FormData multipart uploads.\n` +
        `You are running ${process.version}. Install Node 20+ (LTS) and retry.`,
    );
    process.exit(1);
  }
  if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    console.error(
      'FormData/Blob are not available in this runtime. Use Node.js 20 or later.',
    );
    process.exit(1);
  }
}

function parseArgs(argv) {
  const out = { advance: false, badArg: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--advance') out.advance = true;
    else if (a === '--input') out.input = argv[++i];
    else if (a === '--api') out.api = argv[++i];
    else if (a === '--creator') out.creator = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else {
      console.error(`Unknown argument: ${a}`);
      out.help = true;
      out.badArg = true;
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node run.js [options]

Options:
  --input <dir>    Input folder (default: env INPUT_DIR or rpa/SmartHubBot/Inputs)
  --api <url>      API base URL (default: env API_BASE or http://localhost:3001)
  --creator <id>   creator_id for articles (default: env CREATOR_USER_ID or 1)
  --advance        After create, PUT status to Reviewed (or set ADVANCE_TO_REVIEWED=true)
  -h, --help       Show this help
`);
}

function envBool(name, defaultValue) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultValue;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

function envInt(name, defaultValue) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultValue;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function joinUrl(base, pathname) {
  const b = String(base).replace(/\/+$/, '');
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${b}${p}`;
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstNonEmptyLine(text) {
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (t.length > 0) return t;
  }
  return '';
}

function buildTitle(text, filename) {
  const line = firstNonEmptyLine(text);
  if (!line) return `Untitled (${filename})`;
  return line.length > 120 ? line.slice(0, 120) : line;
}

function buildSummary(text) {
  const s = String(text);
  return s.length > 280 ? s.slice(0, 280) : s;
}

function deriveTags(filename) {
  const base = path.basename(filename).toLowerCase();
  const rules = [
    ['teams', 'Teams Export'],
    ['email', 'Email Thread'],
    ['customs', 'Customs'],
    ['dock', 'Dock Operations'],
    ['billing', 'Billing'],
  ];
  let primary = 'Logistics';
  for (const [needle, label] of rules) {
    if (base.includes(needle)) {
      primary = label;
      break;
    }
  }
  return [primary, 'SOP'];
}

function extensionKind(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
  return ext;
}

const EXTRACT_EXT = new Set(['pdf', 'docx', 'txt', 'md', 'csv']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg']);

function isExtractable(ext) {
  return EXTRACT_EXT.has(ext);
}

function isImage(ext) {
  return IMAGE_EXT.has(ext);
}

async function fetchJson(method, url, options = {}) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { _raw: raw };
  }
  if (!res.ok) {
    const msg =
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'string'
          ? body.error
          : raw.slice(0, 400);
    throw new Error(`HTTP ${res.status} ${method} ${url}: ${msg}`);
  }
  return body;
}

async function postJson(url, payload) {
  return fetchJson('POST', url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function putJson(url, payload) {
  return fetchJson('PUT', url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function postMultipart(url, formData) {
  return fetchJson('POST', url, {
    method: 'POST',
    body: formData,
  });
}

async function postIngestionLog(apiBase, entry) {
  const url = joinUrl(apiBase, '/api/ingestion/log');
  await postJson(url, entry);
}

async function safePostIngestionLog(apiBase, entry) {
  try {
    await postIngestionLog(apiBase, entry);
  } catch (e) {
    console.error(ttyColor(DIM, `[ingestion/log] ${e.message}`));
  }
}

async function checkDuplicate(apiBase, contentHash, windowDays) {
  const url = joinUrl(apiBase, '/api/ingestion/check-duplicate');
  return postJson(url, { content_hash: contentHash, window_days: windowDays });
}

async function extractFile(apiBase, filePath, bytes) {
  const url = joinUrl(apiBase, '/api/extract');
  const name = path.basename(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([bytes]), name);
  return postMultipart(url, fd);
}

async function createArticle(apiBase, payload) {
  const url = joinUrl(apiBase, '/api/articles');
  return postJson(url, payload);
}

async function uploadAttachments(apiBase, articleId, filePath, bytes, uploadedBy) {
  const url = joinUrl(apiBase, `/api/articles/${articleId}/attachments`);
  const name = path.basename(filePath);
  const fd = new FormData();
  fd.append('files', new File([bytes], name));
  fd.append('uploaded_by', String(uploadedBy));
  return postMultipart(url, fd);
}

async function advanceArticleReviewed(apiBase, articleId, actorUserId) {
  const url = joinUrl(apiBase, `/api/articles/${articleId}`);
  return putJson(url, { status: 'Reviewed', actor_user_id: actorUserId });
}

function listInputFiles(inputDir) {
  const entries = readdirSync(inputDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.join(inputDir, e.name))
    .sort((a, b) => a.localeCompare(b));
}

function formatTimestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function writeHtmlSummary(logsDir, counters, rows, startedAt) {
  mkdirSync(logsDir, { recursive: true });
  const stamp = formatTimestamp();
  const filePath = path.join(logsDir, `summary-${stamp}.html`);
  const rowHtml = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.file)}</td><td>${escapeHtml(r.outcome)}</td>` +
        `<td>${escapeHtml(r.articleId)}</td><td>${escapeHtml(r.notes)}</td></tr>`,
    )
    .join('\n');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SmartHub simulator run</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    table { border-collapse: collapse; margin-top: 16px; width: 100%; max-width: 960px; }
    th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f4f4f4; }
    .meta { color: #555; font-size: 0.95rem; }
  </style>
</head>
<body>
  <h1>SmartHub RPA simulator</h1>
  <p class="meta">Started: ${escapeHtml(startedAt)} &middot; Written: ${escapeHtml(new Date().toISOString())}</p>
  <h2>Counters</h2>
  <table>
    <tr><th>Created</th><th>Updated</th><th>Duplicates</th><th>Failed</th></tr>
    <tr>
      <td>${counters.Created}</td>
      <td>${counters.Updated}</td>
      <td>${counters.Duplicates}</td>
      <td>${counters.Failed}</td>
    </tr>
  </table>
  <h2>Per file</h2>
  <table>
    <tr><th>File</th><th>Outcome</th><th>Article ID</th><th>Notes</th></tr>
    ${rowHtml}
  </table>
</body>
</html>`;
  writeFileSync(filePath, html, 'utf8');
  return filePath;
}

async function processOneFile({
  apiBase,
  filePath,
  creatorId,
  windowDays,
  advanceReviewed,
  counters,
  rows,
}) {
  const filename = path.basename(filePath);
  const ext = extensionKind(filePath);
  const row = { file: filename, outcome: '', articleId: '', notes: '' };

  let contentHash = '';
  try {
    const bytes = readFileSync(filePath);
    contentHash = sha256Hex(bytes);

    const dup = await checkDuplicate(apiBase, contentHash, windowDays);
    if (dup.duplicate === true) {
      counters.Duplicates += 1;
      row.outcome = 'duplicate';
      row.articleId = dup.article_id != null ? String(dup.article_id) : '';
      row.notes = dup.last_seen_at ? `last_seen_at=${dup.last_seen_at}` : '';
      await safePostIngestionLog(apiBase, {
        content_hash: contentHash,
        source_path: filePath,
        source_kind: ext || 'unknown',
        outcome: 'duplicate',
        article_id: dup.article_id ?? undefined,
      });
      console.log(
        ttyColor(
          YELLOW,
          `DUPLICATE  ${filename}  hash=${contentHash.slice(0, 12)}…  article=${row.articleId || '—'}`,
        ),
      );
      rows.push(row);
      return;
    }

    let text = '';
    let kind = ext || 'unknown';
    let extractWarning = '';

    if (isImage(ext)) {
      text = '';
      kind = 'image';
      extractWarning = 'Image file: OCR not run; attachment-only ingest.';
    } else if (isExtractable(ext)) {
      const ex = await extractFile(apiBase, filePath, bytes);
      text = typeof ex.text === 'string' ? ex.text : '';
      kind = typeof ex.kind === 'string' ? ex.kind : ext;
      if (ex.warning) extractWarning = String(ex.warning);
    } else {
      throw new Error(`Unsupported extension ".${ext}" (use pdf, docx, txt, md, csv, or png/jpg/jpeg).`);
    }

    const title = buildTitle(text, filename);
    const summary = buildSummary(text);
    const tags = deriveTags(filename);
    const content = text;

    const created = await createArticle(apiBase, {
      title,
      summary,
      content,
      creator_id: creatorId,
      tags,
    });
    const articleId = created.id;
    if (articleId == null) throw new Error('Create article response missing id');

    await uploadAttachments(apiBase, articleId, filePath, bytes, creatorId);

    await postIngestionLog(apiBase, {
      content_hash: contentHash,
      source_path: filePath,
      source_kind: kind,
      outcome: 'created',
      article_id: articleId,
    });

    counters.Created += 1;
    row.outcome = 'created';
    row.articleId = String(articleId);
    const warnParts = [];
    if (extractWarning) warnParts.push(extractWarning);
    if (kind === 'image') warnParts.push('OCR required for text body.');
    row.notes = warnParts.join(' ');

    console.log(
      ttyColor(
        GREEN,
        `CREATED    ${filename}  article_id=${articleId}  title=${title.slice(0, 60)}${title.length > 60 ? '…' : ''}`,
      ),
    );
    if (row.notes) {
      console.log(ttyColor(DIM, `           note: ${row.notes}`));
    }

    if (advanceReviewed) {
      await advanceArticleReviewed(apiBase, articleId, creatorId);
      counters.Updated += 1;
      console.log(ttyColor(CYAN, `REVIEWED   ${filename}  article_id=${articleId}`));
    }
  } catch (err) {
    counters.Failed += 1;
    row.outcome = 'failed';
    row.notes = err.message;
    console.error(ttyColor(RED, `FAILED     ${filename}  ${err.message}`));
    await safePostIngestionLog(apiBase, {
      content_hash: contentHash,
      source_path: filePath,
      source_kind: ext || 'unknown',
      outcome: 'failed',
      message: err.message,
    });
  }

  rows.push(row);
}

async function main() {
  requireNode20Plus();

  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(args.badArg ? 1 : 0);
  }

  const apiBase =
    args.api ?? process.env.API_BASE?.trim() || 'http://localhost:3001';
  const inputDir = path.resolve(
    process.cwd(),
    args.input ??
      process.env.INPUT_DIR?.trim() ||
      path.join('rpa', 'SmartHubBot', 'Inputs'),
  );
  const creatorId = args.creator
    ? Number.parseInt(String(args.creator), 10)
    : envInt('CREATOR_USER_ID', 1);
  const windowDays = envInt('WINDOW_DAYS', 14);
  const advanceReviewed =
    args.advance === true || envBool('ADVANCE_TO_REVIEWED', false);

  const counters = { Created: 0, Updated: 0, Duplicates: 0, Failed: 0 };
  const rows = [];
  const startedAt = new Date().toISOString();

  console.log(
    ttyColor(DIM, `API_BASE=${apiBase}\nINPUT_DIR=${inputDir}\nCREATOR_ID=${creatorId}\nWINDOW_DAYS=${windowDays}\nADVANCE_REVIEWED=${advanceReviewed}`),
  );

  let files;
  try {
    files = listInputFiles(inputDir);
  } catch (e) {
    console.error(ttyColor(RED, `Cannot read input directory: ${e.message}`));
    process.exit(1);
  }

  if (files.length === 0) {
    console.log(ttyColor(DIM, 'No files in input directory.'));
  }

  for (const filePath of files) {
    await processOneFile({
      apiBase,
      filePath,
      creatorId,
      windowDays,
      advanceReviewed,
      counters,
      rows,
    });
  }

  const logsDir = path.join(__dirname, 'Logs');
  let summaryPath;
  try {
    summaryPath = writeHtmlSummary(logsDir, counters, rows, startedAt);
  } catch (e) {
    console.error(ttyColor(RED, `Could not write HTML summary: ${e.message}`));
  }

  console.log('');
  console.log('────────── Summary ──────────');
  console.log(
    `  Created:     ${counters.Created}\n` +
      `  Updated:     ${counters.Updated}\n` +
      `  Duplicates:  ${counters.Duplicates}\n` +
      `  Failed:      ${counters.Failed}`,
  );
  if (summaryPath) {
    console.log(ttyColor(DIM, `\nHTML summary: ${summaryPath}`));
  }
  console.log('─────────────────────────────');

  process.exit(counters.Failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(ttyColor(RED, e.stack || e.message));
  process.exit(1);
});
