import type { ImageSourcePropType } from 'react-native';

/**
 * Central registry for the zodiac / nakshatra card artwork shown on the
 * cosmic-identity screen.
 *
 * ── How to add an image ──────────────────────────────────────────────────────
 * React Native's `require()` needs a STATIC string path and the file MUST exist
 * at bundle time (a require to a missing file breaks the Metro bundle). So:
 *   1. Drop the file into the folder shown below with the exact lowercase name.
 *   2. Uncomment its line in the matching map.
 *
 * Sign cards (shared by Western AND Vedic — same 12 signs):
 *   assets/images/zodiac/<western-sign>.webp
 *   e.g. aries.webp, taurus.webp, gemini.webp … pisces.webp
 *
 * Nakshatra cards:
 *   assets/images/nakshatra/<name>.webp   (lowercase, spaces → hyphens)
 *   e.g. ashwini.webp, purva-phalguni.webp, uttara-bhadrapada.webp
 *
 * WebP at 700x700 rather than the original PNGs -- the source art came in as
 * ~3MB, 1254x1254 PNGs (no alpha channel, so PNG was compressing them badly
 * for what's photographic/painterly content); at the ~250-280px this renders
 * on cosmic-identity.tsx that was ~20x more pixels and file size than
 * needed, and was the actual cause of "images take a while to load" there --
 * not a caching issue, decoding a 3MB image on every tab switch really is
 * that slow. Re-run scripts/convert-cards.js if source art is replaced.
 */

// ── 12 sign cards (Western names; Vedic reuses these) ────────────────────────
export const SIGN_IMAGES: Record<string, ImageSourcePropType> = {
  aries: require('@/assets/images/zodiac/aries.webp'),
  taurus: require('@/assets/images/zodiac/taurus.webp'),
  gemini: require('@/assets/images/zodiac/gemini.webp'),
  cancer: require('@/assets/images/zodiac/cancer.webp'),
  leo: require('@/assets/images/zodiac/leo.webp'),
  virgo: require('@/assets/images/zodiac/virgo.webp'),
  libra: require('@/assets/images/zodiac/libra.webp'),
  scorpio: require('@/assets/images/zodiac/scorpio.webp'),
  sagittarius: require('@/assets/images/zodiac/sagittarius.webp'),
  capricorn: require('@/assets/images/zodiac/capricorn.webp'),
  aquarius: require('@/assets/images/zodiac/aquarius.webp'),
  pisces: require('@/assets/images/zodiac/pisces.webp'),
};

// Sanskrit API name → display Tamil-Vedic name mapping.
const SANSKRIT_TO_TAMIL_VEDIC: Record<string, string> = {
  mesha: 'mesam',
  vrishabha: 'risabam', vrisabha: 'risabam',
  mithuna: 'midhunam',
  karka: 'kadagam', kataka: 'kadagam',
  simha: 'simmam',
  kanya: 'kanni',
  tula: 'thulaam', thula: 'thulaam',
  vrishchika: 'viruchigam', vrischika: 'viruchigam',
  dhanu: 'dhanusu', dhanus: 'dhanusu',
  makara: 'magaram',
  kumbha: 'kumbam',
  meena: 'meenam',
};

// Vedic (Rashi) → Western sign key, so both toggles share one image set.
const VEDIC_TO_WESTERN: Record<string, string> = {
  mesam: 'aries',
  risabam: 'taurus',
  midhunam: 'gemini',
  kadagam: 'cancer',
  simmam: 'leo',
  kanni: 'virgo',
  thulaam: 'libra',
  viruchigam: 'scorpio',
  dhanusu: 'sagittarius',
  magaram: 'capricorn',
  kumbam: 'aquarius',
  meenam: 'pisces',
};

const cleanKey = (s: string) => s.toLowerCase().trim().replace(/[^a-z]/g, '');

/**
 * Resolve a sign name (Western OR Vedic) to its card image, or null if the
 * caller should fall back to the glyph. Accepts e.g. "Taurus", "taurus",
 * "Vrishabha", "vrishabha".
 */
export function getSignImage(name?: string | null): ImageSourcePropType | null {
  if (!name) return null;
  const key = cleanKey(name);
  const tamilKey = SANSKRIT_TO_TAMIL_VEDIC[key] || key;
  const westernKey = VEDIC_TO_WESTERN[tamilKey] || tamilKey;
  return SIGN_IMAGES[westernKey] ?? null;
}

// ── 27 nakshatra cards ───────────────────────────────────────────────────────
// Keys are the canonical name stripped to lowercase letters (spaces removed),
// so "Purva Phalguni" → "purvaphalguni". The file path can keep hyphens.
export const NAKSHATRA_IMAGES: Record<string, ImageSourcePropType> = {
  ashwini: require('@/assets/images/nakshatra/ashwini.webp'),
  bharani: require('@/assets/images/nakshatra/bharani.webp'),
  bharni: require('@/assets/images/nakshatra/bharani.webp'), // Alias for spelling variation
  krittika: require('@/assets/images/nakshatra/krittika.webp'),
  rohini: require('@/assets/images/nakshatra/rohini.webp'),
  mrigashira: require('@/assets/images/nakshatra/mrigashira.webp'),
  mrigashiras: require('@/assets/images/nakshatra/mrigashira.webp'), // Alias
  ardra: require('@/assets/images/nakshatra/ardra.webp'),
  arudra: require('@/assets/images/nakshatra/ardra.webp'), // Alias
  punarvasu: require('@/assets/images/nakshatra/punarvasu.webp'),
  pushya: require('@/assets/images/nakshatra/pushya.webp'),
  ashlesha: require('@/assets/images/nakshatra/ashlesha.webp'),
  magha: require('@/assets/images/nakshatra/magha.webp'),
  purvaphalguni: require('@/assets/images/nakshatra/purva-phalguni.webp'),
  poorvaphalguni: require('@/assets/images/nakshatra/purva-phalguni.webp'), // Alias
  uttaraphalguni: require('@/assets/images/nakshatra/uttara-phalguni.webp'),
  poorvaphalgun: require('@/assets/images/nakshatra/purva-phalguni.webp'), // Alias
  hasta: require('@/assets/images/nakshatra/hasta.webp'),
  chitra: require('@/assets/images/nakshatra/chitra.webp'),
  swati: require('@/assets/images/nakshatra/swati.webp'),
  vishakha: require('@/assets/images/nakshatra/vishakha.webp'),
  anuradha: require('@/assets/images/nakshatra/anuradha.webp'),
  jyeshta: require('@/assets/images/nakshatra/jyeshta.webp'),
  jyeshtha: require('@/assets/images/nakshatra/jyeshta.webp'), // Alias
  mula: require('@/assets/images/nakshatra/mula.webp'),
  purvaashadha: require('@/assets/images/nakshatra/purva-ashadha.webp'),
  purvashadha: require('@/assets/images/nakshatra/purva-ashadha.webp'), // Alias
  uttaraashadha: require('@/assets/images/nakshatra/uttara-ashadha.webp'),
  uttarashadha: require('@/assets/images/nakshatra/uttara-ashadha.webp'), // Alias
  shravana: require('@/assets/images/nakshatra/shravana.webp'),
  sravana: require('@/assets/images/nakshatra/shravana.webp'), // Alias
  dhanishta: require('@/assets/images/nakshatra/dhanishta.webp'),
  dhanishtha: require('@/assets/images/nakshatra/dhanishta.webp'), // Alias
  shatabhisha: require('@/assets/images/nakshatra/shatabhisha.webp'),
  satabhisha: require('@/assets/images/nakshatra/shatabhisha.webp'), // Alias
  purvabhadrapada: require('@/assets/images/nakshatra/purva-bhadrapad.webp'),
  purvabhadra: require('@/assets/images/nakshatra/purva-bhadrapad.webp'), // Alias
  uttarabhadrapada: require('@/assets/images/nakshatra/uttara-bhadrapada.webp'),
  uttarabhadra: require('@/assets/images/nakshatra/uttara-bhadrapada.webp'), // Alias
  revati: require('@/assets/images/nakshatra/revati.webp'),
};

/** Resolve a nakshatra name to its card image, or null to fall back to the glyph. */
export function getNakshatraImage(name?: string | null): ImageSourcePropType | null {
  if (!name) return null;
  return NAKSHATRA_IMAGES[cleanKey(name)] ?? null;
}
