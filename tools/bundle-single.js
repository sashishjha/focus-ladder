/**
 * Build a single self-contained HTML file (used for quick previews and the
 * Devpost demo artifact). The deployed app on GitHub Pages uses the plain
 * module files; this bundle is a convenience, not the source of truth.
 */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const js = await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  format: 'iife',
  minify: false,
  write: false,
  target: 'es2020'
});
const css = await readFile('src/styles.css', 'utf8');
const svg = await readFile('icons/icon.svg', 'utf8');
let html = await readFile('index.html', 'utf8');
html = html
  // Function replacers: a plain replacement string would treat "$&" inside
  // the code as a pattern and corrupt the bundle.
  .replace('<link rel="stylesheet" href="src/styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="src/app.js"></script>', () => `<script>\n${js.outputFiles[0].text}\n</script>`)
  .replace('<link rel="manifest" href="manifest.webmanifest">', '')
  .replace('<link rel="icon" href="icons/icon.svg" type="image/svg+xml">', `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`)
  .replace('<link rel="apple-touch-icon" href="icons/icon-192.png">', '');
await mkdir('dist', { recursive: true });
await writeFile('dist/focus-ladder.html', html);
console.log(`dist/focus-ladder.html written (${(html.length / 1024).toFixed(0)} KB)`);
