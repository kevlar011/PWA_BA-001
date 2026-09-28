/**
 * Turns the Expo web export into an installable, native-feeling PWA.
 *
 * Expo's `+html.tsx` hook only runs for static rendering. KEVLAR builds with
 * `web.output: "single"` — a pure client-side app, chosen because the store
 * touches browser storage at import time and would crash a Node prerender.
 * So the head is patched here instead, after the export.
 *
 * Run: node scripts/finalize-web.js   (the deploy workflow does this for you)
 */

const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const indexPath = path.join(dist, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html not found — run `npx expo export --platform web` first.');
  process.exit(1);
}

const HEAD = `
    <!-- PWA: installed to the home screen, no browser chrome -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="KEVLAR" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#0B0A07" />
    <meta name="color-scheme" content="dark" />
    <meta name="description" content="Personal mainframe. Banking and docket, on your device." />
    <link rel="apple-touch-icon" href="./icon-180.png" />
    <link rel="manifest" href="./manifest.json" />
    <style id="kevlar-shell">
      html, body, #root { background-color: #0B0A07; height: 100%; }
      body {
        margin: 0;
        /* Removes the grey flash Safari paints on every tap. */
        -webkit-tap-highlight-color: transparent;
        /* No "Copy / Look Up" bubble on long-press. */
        -webkit-touch-callout: none;
        /* No blue drag-select. Inputs opt back in below. */
        -webkit-user-select: none;
        user-select: none;
        /* No rubber-band bounce past the top of the page. */
        overscroll-behavior: none;
        position: fixed;
        width: 100%;
        overflow: hidden;
      }
      input, textarea { -webkit-user-select: text; user-select: text; }
      input, textarea, button { -webkit-appearance: none; appearance: none; }
      ::-webkit-scrollbar { display: none; }
      * { scrollbar-width: none; }
    </style>
    <script id="kevlar-bootstrap">
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          // updateViaCache:'none' stops the browser serving sw.js itself from
          // HTTP cache. Without it iOS can run a months-old worker and never
          // notice a new build exists.
          navigator.serviceWorker
            .register('./sw.js', { updateViaCache: 'none' })
            .then(function (reg) {
              reg.update();
              // Re-check whenever the app is brought back to the foreground,
              // which for an installed PWA is the only reliable moment.
              document.addEventListener('visibilitychange', function () {
                if (!document.hidden) reg.update();
              });
            })
            .catch(function () {});
        });
      }
      // Ask iOS to treat the ledger as persistent rather than evictable cache.
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then(function (already) {
          if (!already) navigator.storage.persist();
        });
      }
    </script>
`;

let html = fs.readFileSync(indexPath, 'utf8');

if (html.includes('kevlar-shell')) {
  console.log('index.html already finalized — nothing to do.');
  process.exit(0);
}

// viewport-fit=cover lets the app paint into the safe areas the way a native
// app does; user-scalable=no removes pinch-zoom, the fastest web-app tell.
html = html.replace(
  /<meta name="viewport"[^>]*\/?>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
);

html = html.replace('</head>', `${HEAD}  </head>`);

fs.writeFileSync(indexPath, html);
console.log('finalized dist/index.html — PWA meta, shell CSS, service worker, persistent storage');
