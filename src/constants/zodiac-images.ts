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
 *   assets/images/zodiac/<western-sign>.png
 *   e.g. aries.png, taurus.png, gemini.png … pisces.png
 *
 * Nakshatra cards:
 *   assets/images/nakshatra/<name>.png   (lowercase, spaces → hyphens)
 *   e.g. ashwini.png, purva-phalguni.png, uttara-bhadrapada.png
 */

// ── 12 sign cards (Western names; Vedic reuses these) ────────────────────────
export const SIGN_IMAGES: Record<string, ImageSourcePropType> = {
  aries: require('@/assets/images/zodiac/aries.png'),
  taurus: require('@/assets/images/zodiac/taurus.png'),
  gemini: require('@/assets/images/zodiac/gemini.png'),
  cancer: require('@/assets/images/zodiac/cancer.png'),
  leo: require('@/assets/images/zodiac/leo.png'),
  virgo: require('@/assets/images/zodiac/virgo.png'),
  libra: require('@/assets/images/zodiac/libra.png'),
  scorpio: require('@/assets/images/zodiac/scorpio.png'),
  sagittarius: require('@/assets/images/zodiac/sagittarius.png'),
  capricorn: require('@/assets/images/zodiac/capricorn.png'),
  aquarius: require('@/assets/images/zodiac/aquarius.png'),
  pisces: require('@/assets/images/zodiac/pisces.png'),
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
  ashwini: require('@/assets/images/nakshatra/ashwini.png'),
  bharani: require('@/assets/images/nakshatra/bharani.png'),
  bharni: require('@/assets/images/nakshatra/bharani.png'), // Alias for spelling variation
  krittika: require('@/assets/images/nakshatra/krittika.png'),
  rohini: require('@/assets/images/nakshatra/rohini.png'),
  mrigashira: require('@/assets/images/nakshatra/mrigashira.png'),
  mrigashiras: require('@/assets/images/nakshatra/mrigashira.png'), // Alias
  ardra: require('@/assets/images/nakshatra/ardra.png'),
  arudra: require('@/assets/images/nakshatra/ardra.png'), // Alias
  punarvasu: require('@/assets/images/nakshatra/punarvasu.png'),
  pushya: require('@/assets/images/nakshatra/pushya.png'),
  ashlesha: require('@/assets/images/nakshatra/ashlesha.png'),
  magha: require('@/assets/images/nakshatra/magha.png'),
  purvaphalguni: require('@/assets/images/nakshatra/purva-phalguni.png'),
  poorvaphalguni: require('@/assets/images/nakshatra/purva-phalguni.png'), // Alias
  uttaraphalguni: require('@/assets/images/nakshatra/uttara-phalguni.png'),
  poorvaphalgun: require('@/assets/images/nakshatra/purva-phalguni.png'), // Alias
  hasta: require('@/assets/images/nakshatra/hasta.png'),
  chitra: require('@/assets/images/nakshatra/chitra.png'),
  swati: require('@/assets/images/nakshatra/swati.png'),
  vishakha: require('@/assets/images/nakshatra/vishakha.png'),
  anuradha: require('@/assets/images/nakshatra/anuradha.png'),
  jyeshta: require('@/assets/images/nakshatra/jyeshta.png'),
  jyeshtha: require('@/assets/images/nakshatra/jyeshta.png'), // Alias
  mula: require('@/assets/images/nakshatra/mula.png'),
  purvaashadha: require('@/assets/images/nakshatra/purva-ashadha.png'),
  purvashadha: require('@/assets/images/nakshatra/purva-ashadha.png'), // Alias
  uttaraashadha: require('@/assets/images/nakshatra/uttara-ashadha.png'),
  uttarashadha: require('@/assets/images/nakshatra/uttara-ashadha.png'), // Alias
  shravana: require('@/assets/images/nakshatra/shravana.png'),
  sravana: require('@/assets/images/nakshatra/shravana.png'), // Alias
  dhanishta: require('@/assets/images/nakshatra/dhanishta.png'),
  dhanishtha: require('@/assets/images/nakshatra/dhanishta.png'), // Alias
  shatabhisha: require('@/assets/images/nakshatra/shatabhisha.png'),
  satabhisha: require('@/assets/images/nakshatra/shatabhisha.png'), // Alias
  purvabhadrapada: require('@/assets/images/nakshatra/purva-bhadrapad.png'),
  purvabhadra: require('@/assets/images/nakshatra/purva-bhadrapad.png'), // Alias
  uttarabhadrapada: require('@/assets/images/nakshatra/uttara-bhadrapada.png'),
  uttarabhadra: require('@/assets/images/nakshatra/uttara-bhadrapada.png'), // Alias
  revati: require('@/assets/images/nakshatra/revati.png'),
};

/** Resolve a nakshatra name to its card image, or null to fall back to the glyph. */
export function getNakshatraImage(name?: string | null): ImageSourcePropType | null {
  if (!name) return null;
  return NAKSHATRA_IMAGES[cleanKey(name)] ?? null;
}
