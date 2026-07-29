#!/usr/bin/env node
/**
 * App Store screenshots for Iris.
 * Output: docs/store-screenshots/*.png at 1290×2796
 */
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs/store-screenshots/src');
const OUT = path.join(ROOT, 'docs/store-screenshots');

const W = 1290;
const H = 2796;
const BG = '#011B4A';
const BEZEL = '#0A0A0A';

const PAD_X = 96;
const CAPTION_TOP = 120;
const PHONE_TOP = 620;
const PHONE_SIDE = 110;
const BEZEL_W = 18;
const CORNER_OUTER = 88;
const CORNER_INNER = 72;

function escapeXml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function captionSvg(lines, { top = CAPTION_TOP, fontSize = 92, lineHeight = 108 } = {}) {
  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight;
      return `<tspan x="${PAD_X}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text
    y="${top}"
    fill="#FFFFFF"
    font-family="Georgia, 'Times New Roman', Times, serif"
    font-size="${fontSize}"
    font-weight="700"
    letter-spacing="-1.5"
  >${tspans}</text>
</svg>`);
}

function coverTitleSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text
    x="${W / 2}"
    y="1680"
    text-anchor="middle"
    fill="#FFFFFF"
    font-family="Georgia, 'Times New Roman', Times, serif"
    font-size="120"
    font-weight="700"
    letter-spacing="-2"
  >Iris</text>
  <text
    x="${PAD_X}"
    y="1980"
    fill="#FFFFFF"
    font-family="Georgia, 'Times New Roman', Times, serif"
    font-size="88"
    font-weight="700"
    letter-spacing="-1.5"
  >
    <tspan x="${PAD_X}" dy="0">Looks baked into</tspan>
    <tspan x="${PAD_X}" dy="104">every shot.</tspan>
  </text>
</svg>`);
}

async function solidBg() {
  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: BG,
    },
  })
    .png()
    .toBuffer();
}

async function makePhoneScreen(screenshotPath) {
  const phoneW = W - PHONE_SIDE * 2;
  // Extend below canvas so the frame is cropped at the bottom
  const phoneH = Math.round(phoneW * (19.5 / 9));
  const screenW = phoneW - BEZEL_W * 2;
  const screenH = phoneH - BEZEL_W * 2;

  const screenMask = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${screenW}" height="${screenH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${screenW}" height="${screenH}" rx="${CORNER_INNER}" ry="${CORNER_INNER}" fill="#fff"/>
</svg>`);

  const screen = await sharp(screenshotPath)
    .resize(screenW, screenH, { fit: 'cover', position: 'top' })
    .composite([{ input: screenMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const frameSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${phoneW}" height="${phoneH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${phoneW}" height="${phoneH}" rx="${CORNER_OUTER}" ry="${CORNER_OUTER}" fill="${BEZEL}"/>
</svg>`);

  return sharp(frameSvg)
    .composite([{ input: screen, left: BEZEL_W, top: BEZEL_W }])
    .png()
    .toBuffer()
    .then(async (buf) => {
      // Crop to what fits on canvas from PHONE_TOP downward
      const visibleH = H - PHONE_TOP + 40;
      return sharp(buf)
        .extract({
          left: 0,
          top: 0,
          width: phoneW,
          height: Math.min(phoneH, visibleH),
        })
        .png()
        .toBuffer();
    });
}

async function composeFeature({ outName, screenshot, captionLines }) {
  const bg = await solidBg();
  const phone = await makePhoneScreen(path.join(SRC, screenshot));
  const caption = captionSvg(captionLines);
  const phoneMeta = await sharp(phone).metadata();

  const left = Math.round((W - phoneMeta.width) / 2);

  await sharp(bg)
    .composite([
      { input: caption, left: 0, top: 0 },
      { input: phone, left, top: PHONE_TOP },
    ])
    .png()
    .toFile(path.join(OUT, outName));

  console.log(`wrote ${outName}`);
}

async function composeCover() {
  const bg = await solidBg();
  const iconSize = 420;
  const icon = await sharp(path.join(SRC, 'icon.png'))
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Soft rounded mask for icon (App Store style squircle-ish)
  const iconMask = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${iconSize}" height="${iconSize}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${iconSize}" height="${iconSize}" rx="94" ry="94" fill="#fff"/>
</svg>`);

  const maskedIcon = await sharp(icon)
    .composite([{ input: iconMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const title = coverTitleSvg();
  const iconLeft = Math.round((W - iconSize) / 2);
  const iconTop = 520;

  await sharp(bg)
    .composite([
      { input: maskedIcon, left: iconLeft, top: iconTop },
      { input: title, left: 0, top: 0 },
    ])
    .png()
    .toFile(path.join(OUT, '01-cover.png'));

  console.log('wrote 01-cover.png');
}

async function main() {
  await mkdir(OUT, { recursive: true });

  await composeCover();

  await composeFeature({
    outName: '02-camera.png',
    screenshot: 'iris_main_screen.png',
    captionLines: ['Pro controls.', 'Film looks.'],
  });
  await composeFeature({
    outName: '03-gallery.png',
    screenshot: 'iris_gallery.png',
    captionLines: ['Browse by look', 'and type.'],
  });
  await composeFeature({
    outName: '04-photo.png',
    screenshot: 'iris_gallery_details.png',
    captionLines: ['Before / after', 'and EXIF.'],
  });
  await composeFeature({
    outName: '05-settings.png',
    screenshot: 'settings.png',
    captionLines: ['Defaults that', 'stick.'],
  });
  await composeFeature({
    outName: '06-looks.png',
    screenshot: 'bake_result.png',
    captionLines: ['Kodak Gold,', 'baked in.'],
  });

  const files = (await readdir(OUT)).filter((f) => f.endsWith('.png') && !f.startsWith('.'));
  console.log(`done — ${files.length} files in ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
