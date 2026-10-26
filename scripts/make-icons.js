/**
 * Generates KEVLAR's app icon, splash mark and favicon.
 *
 * Written as a tiny PNG encoder rather than pulling in a graphics dependency,
 * the artwork is pure geometry (a bracketed monogram on amber phosphor), so a
 * few hundred lines of pixel maths is cheaper than another node_modules tree.
 *
 * Run: node scripts/make-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------------------------------------------------------------- PNG ---- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8Array of w*h*4 */
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each scanline gets a leading filter byte (0 = none).
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy
      ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
      : Buffer.from(rgba.subarray(y * w * 4, (y + 1) * w * 4)).copy(
          raw,
          y * (w * 4 + 1) + 1
        );
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------- canvas --- */

function canvas(w, h) {
  const px = Buffer.alloc(w * h * 4);
  return {
    w,
    h,
    px,
    set(x, y, [r, g, b, a = 255]) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      if (a === 255) {
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = 255;
        return;
      }
      // Source-over blend against whatever is already there.
      const sa = a / 255;
      const da = px[i + 3] / 255;
      const oa = sa + da * (1 - sa);
      px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / (oa || 1));
      px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / (oa || 1));
      px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / (oa || 1));
      px[i + 3] = Math.round(oa * 255);
    },
    fill(color) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.set(x, y, color);
    },
  };
}

const BG = [11, 10, 7, 255];
const AMBER = [255, 176, 0, 255];
const AMBER_DIM = [122, 84, 0, 255];

/** Distance from point to line segment, for drawing thick strokes. */
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Draws the KEVLAR mark: a bracketed monogram K, the way it would look
 * burned into an amber phosphor tube.
 */
function drawMark(c, opts = {}) {
  const { w, h } = c;
  const S = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const bg = opts.background !== false;

  if (bg) c.fill(BG);

  // Outer bracket frame, corners only, like a targeting reticle.
  const inset = S * 0.11;
  const thick = Math.max(2, S * 0.028);
  const armLen = S * 0.17;
  const corners = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ];
  for (const [ox, oy, sx, sy] of corners) {
    for (let i = 0; i < armLen; i++) {
      for (let t = 0; t < thick; t++) {
        c.set(Math.round(ox + sx * i), Math.round(oy + sy * t), AMBER);
        c.set(Math.round(ox + sx * t), Math.round(oy + sy * i), AMBER);
      }
    }
  }

  // The K itself.
  const kH = S * 0.4;
  const stroke = S * 0.072;
  const top = cy - kH / 2;
  const bot = cy + kH / 2;
  const stemX = cx - S * 0.15;
  const armX = cx + S * 0.17;

  for (let y = Math.floor(top - stroke); y < Math.ceil(bot + stroke); y++) {
    for (let x = Math.floor(stemX - stroke); x < Math.ceil(armX + stroke); x++) {
      const dStem = distToSeg(x, y, stemX, top, stemX, bot);
      const dUp = distToSeg(x, y, stemX, cy, armX, top);
      const dDown = distToSeg(x, y, stemX, cy, armX, bot);
      const d = Math.min(dStem, dUp, dDown);
      if (d <= stroke / 2) {
        c.set(x, y, AMBER);
      } else if (d <= stroke / 2 + 1.4) {
        // Cheap antialiasing on the edge.
        const a = Math.round(255 * (1 - (d - stroke / 2) / 1.4));
        c.set(x, y, [AMBER[0], AMBER[1], AMBER[2], a]);
      }
    }
  }

  // Phosphor scanlines across the whole face.
  if (bg) {
    for (let y = 0; y < h; y += Math.max(3, Math.round(S / 170))) {
      for (let x = 0; x < w; x++) c.set(x, y, [0, 0, 0, 46]);
    }
  }

  // A single underline bar, the terminal's cursor rail.
  const barY = Math.round(cy + S * 0.3);
  const barW = S * 0.22;
  for (let x = Math.round(cx - barW / 2); x < Math.round(cx + barW / 2); x++) {
    for (let t = 0; t < Math.max(2, S * 0.014); t++) c.set(x, barY + t, AMBER_DIM);
  }
}

/* ---------------------------------------------------------------- run ---- */

const out = path.join(__dirname, '..', 'assets', 'images');
fs.mkdirSync(out, { recursive: true });

function write(name, size, opts) {
  const c = canvas(size, size);
  drawMark(c, opts);
  fs.writeFileSync(path.join(out, name), encodePng(size, size, c.px));
  console.log(`wrote ${name} (${size}x${size})`);
}

write('icon.png', 1024);
write('splash-icon.png', 512, { background: false });
write('favicon.png', 96);
write('android-icon-foreground.png', 432, { background: false });

// Android adaptive background is a flat plate.
const bgPlate = canvas(432, 432);
bgPlate.fill(BG);
fs.writeFileSync(
  path.join(out, 'android-icon-background.png'),
  encodePng(432, 432, bgPlate.px)
);
console.log('wrote android-icon-background.png (432x432)');

/* PWA icons live in public/, which the web export copies to the site root. */
const pub = path.join(__dirname, '..', 'public');
fs.mkdirSync(pub, { recursive: true });

function writePublic(name, size, opts) {
  const c = canvas(size, size);
  drawMark(c, opts);
  fs.writeFileSync(path.join(pub, name), encodePng(size, size, c.px));
  console.log(`wrote public/${name} (${size}x${size})`);
}

writePublic('icon-192.png', 192);
writePublic('icon-512.png', 512);
writePublic('icon-180.png', 180); // apple-touch-icon
writePublic('favicon.png', 96);

/*
 * Maskable icons get cropped to whatever shape the OS fancies, so the mark is
 * drawn smaller inside a full-bleed plate to survive the crop.
 */
const mask = canvas(512, 512);
mask.fill(BG);
const inner = canvas(320, 320);
drawMark(inner, { background: false });
for (let y = 0; y < 320; y++) {
  for (let x = 0; x < 320; x++) {
    const i = (y * 320 + x) * 4;
    const a = inner.px[i + 3];
    if (a > 0) mask.set(x + 96, y + 96, [inner.px[i], inner.px[i + 1], inner.px[i + 2], a]);
  }
}
fs.writeFileSync(path.join(pub, 'icon-maskable-512.png'), encodePng(512, 512, mask.px));
console.log('wrote public/icon-maskable-512.png (512x512)');
