/**
 * Task parsing for Focus Ladder.
 *
 * Turns a free-text "brain dump" into one or more task pieces, each with a
 * guessed verb, object, optional quantity and a deadline hint. Everything in
 * here is deterministic and dependency-free so it runs offline in the browser
 * and in Node for tests.
 */

const SPLIT_PATTERNS = [
  /\r?\n+/,            // one task per line
  /;\s*/,              // semicolons
  /\s+and then\s+/i,   // "and then"
  /,\s*then\s+/i,      // ", then"
  /\s+then\s+/i,       // "then"
  /\s*\.\s+(?=[a-z])/i // sentence boundaries followed by more text
];

const BULLET = /^\s*(?:[-*\u2022\u25E6\u2023]|\d+[.)])\s+/;

const DEADLINE_WORDS = [
  'today', 'tonight', 'tomorrow', 'asap', 'urgent', 'overdue', 'due',
  'deadline', 'by monday', 'by tuesday', 'by wednesday', 'by thursday',
  'by friday', 'by saturday', 'by sunday', 'this week', 'before class',
  'before work', 'by noon', 'by midnight', 'by eod', 'late'
];

const QUANTITY = /\b(\d{1,3})\s+([a-z][a-z-]*)/i;

// Single words that are never a task on their own and should be glued to
// the previous piece ("...and", "also").
const FRAGMENTS = new Set(['and', 'also', 'then', 'or', 'but', 'too', 'etc', 'plus', 'after', 'before', 'later', 'maybe', 'again', 'more']);

const UNIT_SINGULAR = {
  chapters: 'chapter', pages: 'page', emails: 'email', messages: 'message',
  problems: 'problem', questions: 'question', exercises: 'exercise',
  slides: 'slide', forms: 'form', boxes: 'box', bags: 'bag', loads: 'load',
  calls: 'call', sections: 'section', papers: 'paper', articles: 'article',
  lectures: 'lecture', videos: 'video', rooms: 'room', drawers: 'drawer',
  shelves: 'shelf', tasks: 'task', items: 'item', bills: 'bill',
  applications: 'application', essays: 'essay', reports: 'report',
  paragraphs: 'paragraph', sets: 'set', hours: 'hour', minutes: 'minute'
};

const LEADING_FILLER = /^(?:i\s+(?:need|have|want|should|must|gotta|got)\s+to\s+|i\s+(?:need|have|want)\s+|(?:need|have|got|gotta)\s+to\s+|to\s+|please\s+|finally\s+|really\s+(?:need\s+to\s+)?|just\s+|somehow\s+|still\s+(?:need\s+to\s+)?)/i;

/**
 * Normalise whitespace and strip bullets and leading filler such as
 * "I need to".
 * @param {string} text
 * @returns {string}
 */
export function cleanPiece(text) {
  let t = String(text || '').replace(BULLET, '').trim();
  t = t.replace(/\s+/g, ' ');
  t = t.replace(LEADING_FILLER, '');
  t = t.replace(/[.!?\s]+$/g, '');
  return t.trim();
}

/**
 * Split a dump into candidate pieces. Keeps the original order. Connector
 * fragments ("and", "also") are glued to the previous piece; a real one-word
 * task such as "pack" stays its own piece.
 * @param {string} dump
 * @returns {string[]}
 */
export function splitDump(dump) {
  let parts = [String(dump || '')];
  for (const pattern of SPLIT_PATTERNS) {
    parts = parts.flatMap((p) => p.split(pattern));
  }
  const cleaned = parts.map(cleanPiece).filter(Boolean);
  const merged = [];
  for (const piece of cleaned) {
    const isFragment = FRAGMENTS.has(piece.toLowerCase()) || piece.length < 3;
    if (isFragment && merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${piece}`;
    } else {
      merged.push(piece);
    }
  }
  return merged;
}

/**
 * Find a quantity such as "3 chapters" and return it with a singular unit.
 * @param {string} piece
 * @returns {{count:number, unit:string, unitSingular:string}|null}
 */
export function extractQuantity(piece) {
  const m = QUANTITY.exec(piece);
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isFinite(count) || count < 2 || count > 60) return null;
  const unit = m[2].toLowerCase();
  if (unit === 'pm' || unit === 'am' || unit === 'o' || unit === 'oclock') return null;
  const unitSingular = UNIT_SINGULAR[unit] || unit.replace(/s$/, '');
  return { count, unit, unitSingular };
}

/**
 * Detect deadline pressure words. The engine only uses this to order tasks;
 * it never schedules anything.
 * @param {string} piece
 * @returns {boolean}
 */
export function hasDeadlineHint(piece) {
  const lower = piece.toLowerCase();
  return DEADLINE_WORDS.some((w) => lower.includes(w));
}

/**
 * Guess verb and object. The verb is the first word when it looks like an
 * imperative; the object is the rest with deadline phrases trimmed.
 * @param {string} piece
 * @returns {{verb:string, object:string}}
 */
export function extractVerbObject(piece) {
  const words = piece.split(' ');
  const verb = (words[0] || '').toLowerCase();
  let object = words.slice(1).join(' ');
  object = object
    .replace(/\b(?:by|before|due|until)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|today|noon|midnight|eod|next week|this week|class|work)\b.*$/i, '')
    .replace(/\b(?:today|tonight|tomorrow|asap|urgently|urgent)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!object) object = piece;
  return { verb, object };
}

/**
 * Parse a brain dump into structured task pieces.
 * @param {string} dump
 * @returns {{raw:string, pieces:Array<{text:string, verb:string, object:string, quantity:(object|null), deadline:boolean}>}}
 */
export function parseDump(dump) {
  const raw = String(dump || '');
  const pieces = splitDump(raw).map((text) => {
    const { verb, object: fullObject } = extractVerbObject(text);
    const quantity = extractQuantity(text);
    return {
      text,
      verb,
      object: stripQuantity(fullObject, quantity),
      quantity,
      deadline: hasDeadlineHint(text)
    };
  });
  return { raw, pieces };
}

/**
 * Remove "3 chapters of" from an object once the quantity has been captured
 * separately, so templates read "the stats textbook" instead of
 * "3 chapters of the stats textbook". Falls back to "the chapters" when the
 * quantity was the whole object ("read 40 pages").
 * @param {string} object
 * @param {{count:number, unit:string}|null} quantity
 */
export function stripQuantity(object, quantity) {
  if (!quantity) return object;
  const re = new RegExp(`\\b${quantity.count}\\s+${quantity.unit}\\b\\s*(?:of\\s+)?`, 'i');
  const stripped = object.replace(re, '').replace(/\s+/g, ' ').trim();
  if (/^(and|or|,|&)\b/i.test(stripped)) return object; // "5 shirts and 2 towels": keep whole
  return stripped || `the ${quantity.unit}`;
}
