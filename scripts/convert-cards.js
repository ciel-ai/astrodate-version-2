/* global __dirname */
// Resizes + re-encodes the cosmic-identity zodiac/nakshatra card art from
// source PNGs to WebP. See the comment above SIGN_IMAGES in
// src/constants/zodiac-images.ts for why: the source art comes in as ~3MB,
// 1254x1254 PNGs with no alpha channel (so PNG compresses it badly), but the
// card only renders at ~250-280px on screen.
//
// Usage: drop a new `<name>.png` into assets/images/zodiac/ or
// assets/images/nakshatra/ (same naming as the existing files), then run:
//   node scripts/convert-cards.js
// It (re)generates the matching `<name>.webp` next to it. zodiac-images.ts
// requires the .webp file, not the .png -- the PNG is just the source you
// drop in, not itself bundled.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../assets/images');

const ZODIAC_FILES = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const NAKSHATRA_FILES = [
  'ashwini', 'bharani', 'krittika', 'rohini', 'mrigashira', 'ardra',
  'punarvasu', 'pushya', 'ashlesha', 'magha', 'purva-phalguni', 'uttara-phalguni',
  'hasta', 'chitra', 'swati', 'vishakha', 'anuradha', 'jyeshta', 'mula',
  'purva-ashadha', 'uttara-ashadha', 'shravana', 'dhanishta', 'shatabhisha',
  'purva-bhadrapad', 'uttara-bhadrapada', 'revati',
];

const TARGET_SIZE = 700;
const WEBP_QUALITY = 82;

async function convertOne(dir, name) {
  const src = path.join(ROOT, dir, `${name}.png`);
  if (!fs.existsSync(src)) {
    console.log(`${dir}/${name}: skipped (no source .png)`);
    return null;
  }
  const dst = path.join(ROOT, dir, `${name}.webp`);
  const before = fs.statSync(src).size;
  await sharp(src)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover' })
    .webp({ quality: WEBP_QUALITY })
    .toFile(dst);
  const after = fs.statSync(dst).size;
  console.log(
    `${dir}/${name}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`
  );
  return { before, after };
}

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;

  for (const name of ZODIAC_FILES) {
    const result = await convertOne('zodiac', name);
    if (result) {
      totalBefore += result.before;
      totalAfter += result.after;
    }
  }
  for (const name of NAKSHATRA_FILES) {
    const result = await convertOne('nakshatra', name);
    if (result) {
      totalBefore += result.before;
      totalAfter += result.after;
    }
  }

  console.log('---');
  console.log(`Total: ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
