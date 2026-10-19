/**
 * Accessibility helpers: live-region announcements, focus management on
 * view changes, and safe HTML escaping for templates.
 */

/**
 * Escape text for safe insertion into HTML.
 * @param {unknown} value
 */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Announce a message to screen readers. Clears first so repeated identical
 * messages are still spoken.
 * @param {string} message
 * @param {'polite'|'assertive'} [politeness]
 * @param {Document} [doc]
 */
export function announce(message, politeness = 'polite', doc = document) {
  const id = politeness === 'assertive' ? 'announcer-assertive' : 'announcer';
  const region = doc.getElementById(id);
  if (!region) return;
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 30);
}

/**
 * Move keyboard focus to the first heading of a freshly rendered view so
 * screen-reader users hear where they are.
 * @param {HTMLElement} container
 */
export function focusHeading(container) {
  const heading = container.querySelector('h1, [data-autofocus]');
  if (heading instanceof HTMLElement) {
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: false });
  } else {
    const main = container.closest('main') || container;
    if (main instanceof HTMLElement) main.focus();
  }
}

/**
 * Whether a keyboard event happened while typing into a field. Shortcuts
 * must never fire there.
 * @param {KeyboardEvent} event
 */
export function isTypingTarget(event) {
  const t = event.target;
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(t.isContentEditable);
}

/**
 * Apply settings as data attributes on the root element.
 * @param {{theme:string, textSize:string, font:string, reduceMotion:string}} settings
 * @param {Document} [doc]
 */
export function applyAppearance(settings, doc = document) {
  const root = doc.documentElement;
  root.setAttribute('data-theme', settings.theme);
  root.setAttribute('data-size', settings.textSize);
  root.setAttribute('data-font', settings.font);
  root.setAttribute('data-motion', settings.reduceMotion);
}
