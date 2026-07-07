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

// Vedic (Rashi) → Western sign key, so both toggles share one image set.
const VEDIC_TO_WESTERN: Record<string, string> = {
  mesha: 'aries',
  vrishabha: 'taurus',
  vrisabha: 'taurus',
  mithuna: 'gemini',
  karka: 'cancer',
  kataka: 'cancer',
  simha: 'leo',
  kanya: 'virgo',
  tula: 'libra',
  thula: 'libra',
  vrishchika: 'scorpio',
  vrischika: 'scorpio',
  dhanu: 'sagittarius',
  dhanus: 'sagittarius',
  makara: 'capricorn',
  kumbha: 'aquarius',
  meena: 'pisces',
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
  const westernKey = VEDIC_TO_WESTERN[key] || key;
  return SIGN_IMAGES[westernKey] ?? null;
}

// ── 27 nakshatra cards ───────────────────────────────────────────────────────
// Keys are the canonical name stripped to lowercase letters (spaces removed),
// so "Purva Phalguni" → "purvaphalguni". The file path can keep hyphens.
export const NAKSHATRA_IMAGES: Record<string, ImageSourcePropType> = {
  // ashwini: require('@/assets/images/nakshatra/ashwini.png'),
  // bharani: require('@/assets/images/nakshatra/bharani.png'),
  // krittika: require('@/assets/images/nakshatra/krittika.png'),
  // rohini: require('@/assets/images/nakshatra/rohini.png'),
  // mrigashira: require('@/assets/images/nakshatra/mrigashira.png'),
  // ardra: require('@/assets/images/nakshatra/ardra.png'),
  // punarvasu: require('@/assets/images/nakshatra/punarvasu.png'),
  // pushya: require('@/assets/images/nakshatra/pushya.png'),
  // ashlesha: require('@/assets/images/nakshatra/ashlesha.png'),
  // magha: require('@/assets/images/nakshatra/magha.png'),
  // purvaphalguni: require('@/assets/images/nakshatra/purva-phalguni.png'),
  // uttaraphalguni: require('@/assets/images/nakshatra/uttara-phalguni.png'),
  // hasta: require('@/assets/images/nakshatra/hasta.png'),
  // chitra: require('@/assets/images/nakshatra/chitra.png'),
  // swati: require('@/assets/images/nakshatra/swati.png'),
  // vishakha: require('@/assets/images/nakshatra/vishakha.png'),
  // anuradha: require('@/assets/images/nakshatra/anuradha.png'),
  // jyeshta: require('@/assets/images/nakshatra/jyeshta.png'),
  // mula: require('@/assets/images/nakshatra/mula.png'),
  // purvaashadha: require('@/assets/images/nakshatra/purva-ashadha.png'),
  // uttaraashadha: require('@/assets/images/nakshatra/uttara-ashadha.png'),
  shravana: require('@/assets/images/nakshatra/shravana.png'),
  // dhanishta: require('@/assets/images/nakshatra/dhanishta.png'),
  // shatabhisha: require('@/assets/images/nakshatra/shatabhisha.png'),
  // purvabhadrapada: require('@/assets/images/nakshatra/purva-bhadrapada.png'),
  // uttarabhadrapada: require('@/assets/images/nakshatra/uttara-bhadrapada.png'),
  // revati: require('@/assets/images/nakshatra/revati.png'),
};

/** Resolve a nakshatra name to its card image, or null to fall back to the glyph. */
export function getNakshatraImage(name?: string | null): ImageSourcePropType | null {
  if (!name) return null;
  return NAKSHATRA_IMAGES[cleanKey(name)] ?? null;
}
