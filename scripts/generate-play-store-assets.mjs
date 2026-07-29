#!/usr/bin/env node
/**
 * Google Play assets for Iris.
 * - docs/play-store/feature-graphic.png (1024×500)
 * - docs/play-store/icon-512.png
 * - docs/store-screenshots/android/framed-*.png (1080×1920 phone set)
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IOS_OUT = path.join(ROOT, 'docs/store-screenshots');
const ANDROID_OUT = path.join(ROOT, 'docs/store-screenshots/android');
const PLAY = path.join(ROOT, 'docs/play-store');

const BG = '#011B4A';
const W = 1080;
const H = 1920;

async function framedFromIos(name) {
  await sharp(path.join(IOS_OUT, name))
    .resize(W, H, { fit: 'cover', position: 'top' })
    .png()
    .toFile(path.join(ANDROID_OUT, `framed-${name}`));
  console.log(`wrote android/framed-${name}`);
}

async function featureGraphic() {
  const icon = await sharp(path.join(ROOT, 'assets/images/icon.png'))
    .resize(320, 320, { fit: 'contain' })
    .png()
    .toBuffer();

  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="500" fill="${BG}"/>
  <text x="420" y="230" fill="#FFFFFF" font-family="Georgia, 'Times New Roman', Times, serif" font-size="96" font-weight="700" letter-spacing="-2">Iris</text>
  <text x="420" y="310" fill="#FFFFFF" font-family="Georgia, 'Times New Roman', Times, serif" font-size="36" opacity="0.9">Looks baked into every shot.</text>
</svg>`);

  await sharp(svg)
    .composite([{ input: icon, left: 72, top: 90 }])
    .png()
    .toFile(path.join(PLAY, 'feature-graphic.png'));
  console.log('wrote play-store/feature-graphic.png');
}

async function storeIcon() {
  await sharp(path.join(ROOT, 'assets/images/icon.png'))
    .resize(512, 512)
    .png()
    .toFile(path.join(PLAY, 'icon-512.png'));
  console.log('wrote play-store/icon-512.png');
}

async function main() {
  await mkdir(ANDROID_OUT, { recursive: true });
  await mkdir(PLAY, { recursive: true });

  await featureGraphic();
  await storeIcon();

  for (const name of [
    '02-camera.png',
    '03-gallery.png',
    '04-photo.png',
    '05-settings.png',
    '06-looks.png',
  ]) {
    await framedFromIos(name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
