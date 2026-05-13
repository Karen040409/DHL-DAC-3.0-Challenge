/**
 * SmartHub Draft Builder (offline).
 *
 * Implements the spirit of "Use GPT to summarise, structure, title, tag, propose
 * step-by-step procedures" (assignment 5.3) **without** needing an API key.
 *
 * The same JSON shape would be returned by a real LLM call, so swapping this
 * function for `fetch('/api/draft-builder', …)` later is a one-liner.
 *
 * @typedef {{
 *   title: string,
 *   summary: string,
 *   steps: string[],
 *   tags: string[],
 *   related_links: string[],
 *   notes: string[]
 * }} DraftProposal
 */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'into', 'your',
  'about', 'will', 'their', 'they', 'when', 'then', 'than', 'where', 'which',
  'after', 'before', 'over', 'under', 'because', 'just', 'also', 'been', 'were',
  'said', 'says', 'said:', 'hi', 'hello', 'thanks', 'thank', 'please',
])

const TAG_KEYWORDS = [
  { match: /\bpallet|dock|inbound|outbound|warehouse|sort\b/i, tag: 'Dock Operations' },
  { match: /\bcustom(s)?|hts|hs\s*code|tariff|broker\b/i, tag: 'Customs' },
  { match: /\bsop|procedure|standard operating\b/i, tag: 'SOP' },
  { match: /\binvoice|billing|payment\b/i, tag: 'Billing' },
  { match: /\bsla|service level\b/i, tag: 'SLA' },
  { match: /\bteams\b|telegram|chat|thread/i, tag: 'Teams Export' },
  { match: /\bemail|mailbox|inbox\b/i, tag: 'Email Thread' },
  { match: /\bscreenshot|screen-?cap\b/i, tag: 'Screenshot' },
  { match: /\blogistics?\b/i, tag: 'Logistics' },
  { match: /\bdriver|vehicle|truck|trailer\b/i, tag: 'Fleet' },
  { match: /\bcarrier|fedex|dhl|tnt\b/i, tag: 'Carrier' },
]

const URL_RX = /\bhttps?:\/\/[^\s)]+/g

function splitLines(raw) {
  return String(raw)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function topKeywords(text, max = 6) {
  const counts = new Map()
  const lower = String(text).toLowerCase()
  for (const word of lower.split(/[^a-z0-9]+/)) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w)
}

function deriveTitle(lines, text) {
  const first = lines[0]
  if (first && first.length <= 120 && /[a-zA-Z]/.test(first)) {
    return first
      .replace(/^[#*\->\s]+/, '')
      .replace(/[:.\s]+$/, '')
      .slice(0, 120)
  }
  const kw = topKeywords(text, 4).join(' ')
  return (kw || 'Untitled knowledge article').replace(/\b\w/g, (c) => c.toUpperCase())
}

function deriveSteps(lines) {
  const numbered = []
  for (const line of lines) {
    const m = line.match(/^(\d+)[.)\s-]+(.+)/)
    if (m) numbered.push(m[2].trim())
  }
  if (numbered.length >= 2) return numbered.slice(0, 12)

  const bulleted = lines
    .filter((l) => /^[-*•]/.test(l))
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
  if (bulleted.length >= 2) return bulleted.slice(0, 12)

  return lines.filter((l) => l.length >= 12).slice(1, 8)
}

function deriveSummary(text) {
  const cleaned = String(text)
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'Draft created from upload console (empty source).'
  const sentenceMatch = cleaned.match(/.{60,260}?[.!?](\s|$)/)
  if (sentenceMatch) return sentenceMatch[0].trim()
  return cleaned.slice(0, 240) + (cleaned.length > 240 ? '…' : '')
}

function deriveTags(text, fileNames = []) {
  const tags = new Set()
  for (const { match, tag } of TAG_KEYWORDS) {
    if (match.test(text)) tags.add(tag)
  }
  for (const name of fileNames) {
    if (/\.pdf$/i.test(name)) tags.add('PDF Source')
    if (/\.docx?$/i.test(name)) tags.add('Word Source')
    if (/\.(png|jpe?g|gif|webp)$/i.test(name)) tags.add('Screenshot')
  }
  return [...tags].slice(0, 8)
}

function deriveLinks(text) {
  const found = String(text).match(URL_RX) || []
  return [...new Set(found)].slice(0, 6)
}

function deriveNotes(text, lines) {
  const notes = []
  if (text.length < 60) notes.push('Source text is very short — please confirm content is complete.')
  if (!/\b\d+[.)\s-]/.test(text) && lines.length > 4) {
    notes.push('No numbered steps detected — verify the proposed Steps reflect the actual procedure.')
  }
  if (/confidential|secret|nda/i.test(text)) {
    notes.push('Source mentions confidentiality keywords — review before publishing.')
  }
  return notes
}

/**
 * @param {string} rawText
 * @param {string[]} [fileNames]
 * @returns {DraftProposal}
 */
export function proposeDraft(rawText, fileNames = []) {
  const text = String(rawText ?? '')
  const lines = splitLines(text)
  return {
    title: deriveTitle(lines, text),
    summary: deriveSummary(text),
    steps: deriveSteps(lines),
    tags: deriveTags(text, fileNames),
    related_links: deriveLinks(text),
    notes: deriveNotes(text, lines),
  }
}
