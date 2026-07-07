import { getNakshatraImage, getSignImage } from '@/constants/zodiac-images';
import { getAstroDetails, parseTzString } from '@/lib/astro';
import { getTimezoneOffset, searchBirthPlace } from '@/lib/astro-geo';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, ImageBackground, Platform, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Lightweight glyph icons — the rest of the app renders icons as emoji/text
 * (no @expo/vector-icons dependency is installed), so we follow that here.
 */
function Sparkle({ size = 14, color = '#A855F7', style }: { size?: number; color?: string; style?: TextStyle | TextStyle[] }) {
  return <Text style={[{ fontSize: size, color, lineHeight: size + 2 }, style as any]}>✦</Text>;
}

/**
 * Gradient background via CSS `experimental_backgroundImage` instead of
 * expo-linear-gradient — the ExpoLinearGradient native module isn't present in
 * the current dev build, so we use the same approach as the app's action buttons.
 */
function GradientView({
  colors,
  angle = 135,
  style,
  children,
}: {
  colors: readonly string[];
  angle?: number;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        style as any,
        { experimental_backgroundImage: `linear-gradient(${angle}deg, ${colors.join(', ')})` } as any,
      ]}
    >
      {children}
    </View>
  );
}
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// Western Zodiac Signs
const WESTERN_SIGNS = [
  { name: 'Aries', dates: 'Mar 21 - Apr 19', symbol: '♈', element: 'Fire' },
  { name: 'Taurus', dates: 'Apr 20 - May 20', symbol: '♉', element: 'Earth' },
  { name: 'Gemini', dates: 'May 21 - Jun 20', symbol: '♊', element: 'Air' },
  { name: 'Cancer', dates: 'Jun 21 - Jul 22', symbol: '♋', element: 'Water' },
  { name: 'Leo', dates: 'Jul 23 - Aug 22', symbol: '♌', element: 'Fire' },
  { name: 'Virgo', dates: 'Aug 23 - Sep 22', symbol: '♍', element: 'Earth' },
  { name: 'Libra', dates: 'Sep 23 - Oct 22', symbol: '♎', element: 'Air' },
  { name: 'Scorpio', dates: 'Oct 23 - Nov 21', symbol: '♏', element: 'Water' },
  { name: 'Sagittarius', dates: 'Nov 22 - Dec 21', symbol: '♐', element: 'Fire' },
  { name: 'Capricorn', dates: 'Dec 22 - Jan 19', symbol: '♑', element: 'Earth' },
  { name: 'Aquarius', dates: 'Jan 20 - Feb 18', symbol: '♒', element: 'Air' },
  { name: 'Pisces', dates: 'Feb 19 - Mar 20', symbol: '♓', element: 'Water' },
];

// Modern ruling planets + their glyphs (used in the info pill).
const SIGN_RULERS: Record<string, { ruler: string; symbol: string }> = {
  Aries: { ruler: 'Mars', symbol: '♂' },
  Taurus: { ruler: 'Venus', symbol: '♀' },
  Gemini: { ruler: 'Mercury', symbol: '☿' },
  Cancer: { ruler: 'Moon', symbol: '☽' },
  Leo: { ruler: 'Sun', symbol: '☉' },
  Virgo: { ruler: 'Mercury', symbol: '☿' },
  Libra: { ruler: 'Venus', symbol: '♀' },
  Scorpio: { ruler: 'Pluto', symbol: '♇' },
  Sagittarius: { ruler: 'Jupiter', symbol: '♃' },
  Capricorn: { ruler: 'Saturn', symbol: '♄' },
  Aquarius: { ruler: 'Uranus', symbol: '♅' },
  Pisces: { ruler: 'Neptune', symbol: '♆' },
};

// Vedic (Rashi) → Western sign name, so Vedic can reuse Western dates/ruler/art.
const VEDIC_TO_WESTERN_NAME: Record<string, string> = {
  mesha: 'Aries', vrishabha: 'Taurus', vrisabha: 'Taurus', mithuna: 'Gemini',
  karka: 'Cancer', kataka: 'Cancer', simha: 'Leo', kanya: 'Virgo',
  tula: 'Libra', thula: 'Libra', vrishchika: 'Scorpio', vrischika: 'Scorpio',
  dhanu: 'Sagittarius', dhanus: 'Sagittarius', makara: 'Capricorn',
  kumbha: 'Aquarius', meena: 'Pisces',
};

// Western sign name → Vedic (Rashi) name mappings.
const WESTERN_TO_VEDIC_NAME: Record<string, string> = {
  aries: 'Mesha', taurus: 'Vrishabha', gemini: 'Mithuna', cancer: 'Karka',
  leo: 'Simha', virgo: 'Kanya', libra: 'Tula', scorpio: 'Vrishchika',
  sagittarius: 'Dhanu', capricorn: 'Makara', aquarius: 'Kumbha', pisces: 'Meena',
};

// Zodiac order mapping to distribute symbols clockwise starting from active sign
const ZODIAC_ORDER = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

/** Date range + ruling planet for a Western sign name (case-insensitive). */
const getSignInfo = (westernName?: string | null) => {
  if (!westernName) return null;
  const w = WESTERN_SIGNS.find((s) => s.name.toLowerCase() === westernName.toLowerCase());
  if (!w) return null;
  const ruler = SIGN_RULERS[w.name];
  return { dates: w.dates.replace(/-/g, '–'), ruler: ruler?.ruler ?? null, rulerSymbol: ruler?.symbol ?? null };
};

/** A monochrome glyph that loosely fits a trait word (for the trait pills). */
const traitGlyph = (t: string): string => {
  const s = t.toLowerCase();
  if (/(compassion|caring|loving|empath|devot|kind|gentle|nurtur|warm|friendly)/.test(s)) return '♥';
  if (/(intuit|psychic|insight|percept|wise|deep|mystic|spiritual)/.test(s)) return '≈';
  if (/(dream|artist|creativ|imagin|vision|magic|expressive)/.test(s)) return '✦';
  if (/(bold|brave|courage|energetic|passion|fear|dynamic|confident|leader)/.test(s)) return '✧';
  if (/(disciplin|ambiti|practical|reliab|stable|loyal|patient|persist|diligent)/.test(s)) return '◆';
  return '✦';
};

const getWesternSign = (date: Date): typeof WESTERN_SIGNS[0] => {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return WESTERN_SIGNS[0];
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return WESTERN_SIGNS[1];
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return WESTERN_SIGNS[2];
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return WESTERN_SIGNS[3];
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return WESTERN_SIGNS[4];
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return WESTERN_SIGNS[5];
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return WESTERN_SIGNS[6];
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return WESTERN_SIGNS[7];
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return WESTERN_SIGNS[8];
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return WESTERN_SIGNS[9];
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return WESTERN_SIGNS[10];
  return WESTERN_SIGNS[11];
};

const formatSignLabel = (sign?: string | null) => {
  if (!sign) return null;
  const s = sign.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const getVedicSignName = (signName: string | null | undefined): string | null => {
  if (!signName) return null;
  const name = signName.trim().toLowerCase();
  if (name in VEDIC_TO_WESTERN_NAME) {
    return formatSignLabel(name);
  }
  if (name in WESTERN_TO_VEDIC_NAME) {
    return WESTERN_TO_VEDIC_NAME[name];
  }
  return formatSignLabel(signName);
};

const getWesternSignName = (signName: string | null | undefined): string | null => {
  if (!signName) return null;
  const name = signName.trim().toLowerCase();
  if (name in WESTERN_TO_VEDIC_NAME) {
    return formatSignLabel(signName);
  }
  if (name in VEDIC_TO_WESTERN_NAME) {
    return VEDIC_TO_WESTERN_NAME[name];
  }
  return formatSignLabel(signName);
};

// Western Zodiac Taglines
const WESTERN_TAGLINES: Record<string, string> = {
  'Aries': 'The Pioneer',
  'Taurus': 'The Anchor',
  'Gemini': 'The Alchemist',
  'Cancer': 'The Protector',
  'Leo': 'The Sovereign',
  'Virgo': 'The Perfectionist',
  'Libra': 'The Harmonizer',
  'Scorpio': 'The Mystic',
  'Sagittarius': 'The Seeker',
  'Capricorn': 'The Mastermind',
  'Aquarius': 'The Visionary',
  'Pisces': 'The Dreamer',
};

// Vedic Zodiac Taglines
const VEDIC_TAGLINES: Record<string, string> = {
  'Mesha': 'The Pioneer',
  'Vrishabha': 'The Anchor',
  'Mithuna': 'The Alchemist',
  'Karka': 'The Protector',
  'Simha': 'The Sovereign',
  'Kanya': 'The Perfectionist',
  'Tula': 'The Harmonizer',
  'Vrishchika': 'The Mystic',
  'Dhanu': 'The Seeker',
  'Makara': 'The Mastermind',
  'Kumbha': 'The Visionary',
  'Meena': 'The Dreamer',
};

// Nakshatra Taglines
const NAKSHATRA_TAGLINES: Record<string, string> = {
  'Ashwini': 'The Miracle Worker',
  'Bharani': 'The Bearer of Light',
  'Krittika': 'The Razor Sharp',
  'Rohini': 'The Star of Ascent',
  'Mrigashira': 'The Seeking Star',
  'Ardra': 'The Star of Destiny',
  'Punarvasu': 'The Return of Light',
  'Pushya': 'The Star of Nourishment',
  'Ashlesha': 'The Clinging Star',
  'Magha': 'The Royal Star',
  'Purva Phalguni': 'The Carefree Star',
  'Uttara Phalguni': 'The Patron Star',
  'Hasta': 'The Golden Hand',
  'Chitra': 'The Bright Star',
  'Swati': 'The Sword of Independence',
  'Vishakha': 'The Star of Triumph',
  'Anuradha': 'The Star of Devotion',
  'Jyeshta': 'The Chief Star',
  'Mula': 'The Root Star',
  'Purva Ashadha': 'The Invincible Star',
  'Uttara Ashadha': 'The Universal Star',
  'Shravana': 'The Star of Learning',
  'Dhanishta': 'The Star of Symphony',
  'Shatabhisha': 'The Hundred Healers',
  'Purva Bhadrapada': 'The Spiritual Fire',
  'Uttara Bhadrapada': 'The Cosmic Depth',
  'Revati': 'The Nourishing Guardian',
};

// Western Zodiac Traits
const WESTERN_TRAITS: Record<string, string[]> = {
  'Aries': ['Bold', 'Energetic', 'Passionate'],
  'Taurus': ['Reliable', 'Patient', 'Devoted'],
  'Gemini': ['Adaptable', 'Expressive', 'Curious'],
  'Cancer': ['Intuitive', 'Caring', 'Empathetic'],
  'Leo': ['Generous', 'Creative', 'Confident'],
  'Virgo': ['Loyal', 'Analytical', 'Kind'],
  'Libra': ['Diplomatic', 'Gracious', 'Fair'],
  'Scorpio': ['Brave', 'Passionate', 'Resourceful'],
  'Sagittarius': ['Generous', 'Idealistic', 'Adventurous'],
  'Capricorn': ['Disciplined', 'Ambitious', 'Persistent'],
  'Aquarius': ['Progressive', 'Original', 'Independent'],
  'Pisces': ['Intuitive', 'Compassionate', 'Artistic'],
};

// Vedic Zodiac Traits
const VEDIC_TRAITS: Record<string, string[]> = {
  'Mesha': ['Bold', 'Energetic', 'Leader'],
  'Vrishabha': ['Stable', 'Reliable', 'Artistic'],
  'Mithuna': ['Intellectual', 'Adaptable', 'Expressive'],
  'Karka': ['Intuitive', 'Nurturing', 'Emotional'],
  'Simha': ['Charismatic', 'Bold', 'Generous'],
  'Kanya': ['Practical', 'Analytical', 'Diligent'],
  'Tula': ['Diplomatic', 'Artistic', 'Balanced'],
  'Vrishchika': ['Intense', 'Intuitive', 'Resilient'],
  'Dhanu': ['Optimistic', 'Philosophical', 'Adventurous'],
  'Makara': ['Disciplined', 'Ambitious', 'Practical'],
  'Kumbha': ['Innovative', 'Independent', 'Humanitarian'],
  'Meena': ['Empathetic', 'Intuitive', 'Creative'],
};

// Nakshatra Traits
const NAKSHATRA_TRAITS: Record<string, string[]> = {
  'Ashwini': ['Fast-paced', 'Healing', 'Courageous'],
  'Bharani': ['Creative', 'Responsible', 'Transformative'],
  'Krittika': ['Determined', 'Sharp', 'Ambitious'],
  'Rohini': ['Charming', 'Artistic', 'Nurturing'],
  'Mrigashira': ['Curious', 'Adaptable', 'Seeker'],
  'Ardra': ['Intense', 'Resilient', 'Insightful'],
  'Punarvasu': ['Generous', 'Renewal', 'Optimistic'],
  'Pushya': ['Nurturing', 'Ethical', 'Dependable'],
  'Ashlesha': ['Shrewd', 'Intense', 'Perceptive'],
  'Magha': ['Regal', 'Loyal', 'Ambitious'],
  'Purva Phalguni': ['Artistic', 'Sociable', 'Joyful'],
  'Uttara Phalguni': ['Generous', 'Dutiful', 'Loving'],
  'Hasta': ['Skillful', 'Articulate', 'Creative'],
  'Chitra': ['Dynamic', 'Attractive', 'Creative'],
  'Swati': ['Independent', 'Intuitive', 'Fair'],
  'Vishakha': ['Focused', 'Determined', 'Competitive'],
  'Anuradha': ['Devoted', 'Resilient', 'Friendly'],
  'Jyeshta': ['Protective', 'Authoritative', 'Respected'],
  'Mula': ['Investigative', 'Direct', 'Transformative'],
  'Purva Ashadha': ['Confident', 'Optimistic', 'Adaptable'],
  'Uttara Ashadha': ['Noble', 'Patient', 'Virtuous'],
  'Shravana': ['Attentive', 'Learned', 'Ethical'],
  'Dhanishta': ['Rhythmic', 'Adaptable', 'Prosperous'],
  'Shatabhisha': ['Visionary', 'Independent', 'Healing'],
  'Purva Bhadrapada': ['Spiritual', 'Passionate', 'Unique'],
  'Uttara Bhadrapada': ['Wise', 'Charitable', 'Stable'],
  'Revati': ['Gentle', 'Empathetic', 'Spiritual'],
};

// Western Zodiac Poetic Descriptions
const WESTERN_DESCRIPTIONS: Record<string, string> = {
  'Aries': 'You initiate with fire, lead with passion and live fearlessly. Your pioneering spirit lights the path for others.',
  'Taurus': 'You build on solid ground, appreciate deep beauty and remain patient. Your loyalty is an unshakeable sanctuary.',
  'Gemini': 'You weave words with magic, seek endless wonder and adapt like the wind. Your mind is a canvas of infinite ideas.',
  'Cancer': 'You feel with tide-like depth, nurture with tenderness and protect fiercely. Your heart is a safe harbor in any storm.',
  'Leo': 'You shine like the summer sun, love with open arms and lead with dignity. Your presence warms and inspires everyone.',
  'Virgo': 'You seek quiet perfection, heal with meticulous care and serve with grace. Your intellect brings order to chaos.',
  'Libra': 'You seek ultimate harmony, charm with gentle grace and build bridges. Your soul dances in the search for balance.',
  'Scorpio': 'You walk through shadows, rise from ashes and feel with burning intensity. Your strength lies in your profound rebirth.',
  'Sagittarius': 'You shoot your arrow at the stars, travel with a free soul and seek truth. Your optimism is a guiding beacon.',
  'Capricorn': 'You climb the highest peaks, build lasting legacies and stand resilient. Your patience turns dreams into reality.',
  'Aquarius': 'You dream of a better tomorrow, think outside bounds and stand unique. Your vision is a catalyst for change.',
  'Pisces': 'You feel deeply, dream wildly and love unconditionally. Your intuition guides you like no other.',
};

// Vedic Zodiac Poetic Descriptions
const VEDIC_DESCRIPTIONS: Record<string, string> = {
  'Mesha': 'You initiate with fire, lead with passion and live fearlessly. Your pioneering spirit lights the path for others.',
  'Vrishabha': 'You build on solid ground, appreciate deep beauty and remain patient. Your loyalty is an unshakeable sanctuary.',
  'Mithuna': 'You weave words with magic, seek endless wonder and adapt like the wind. Your mind is a canvas of infinite ideas.',
  'Karka': 'You feel with tide-like depth, nurture with tenderness and protect fiercely. Your heart is a safe harbor in any storm.',
  'Simha': 'You shine like the summer sun, love with open arms and lead with dignity. Your presence warms and inspires everyone.',
  'Kanya': 'You seek quiet perfection, heal with meticulous care and serve with grace. Your intellect brings order to chaos.',
  'Tula': 'You seek ultimate harmony, charm with gentle grace and build bridges. Your soul dances in the search for balance.',
  'Vrishchika': 'You walk through shadows, rise from ashes and feel with burning intensity. Your strength lies in your profound rebirth.',
  'Dhanu': 'You shoot your arrow at the stars, travel with a free soul and seek truth. Your optimism is a guiding beacon.',
  'Makara': 'You climb the highest peaks, build lasting legacies and stand resilient. Your patience turns dreams into reality.',
  'Kumbha': 'You dream of a better tomorrow, think outside bounds and stand unique. Your vision is a catalyst for change.',
  'Meena': 'You feel deeply, dream wildly and love unconditionally. Your intuition guides you like no other.',
};

// Nakshatra Poetic Descriptions
const NAKSHATRA_DESCRIPTIONS: Record<string, string> = {
  'Ashwini': 'You run like the wind, heal with swift touch and bring swift miracles. Your speed and spirit open new horizons.',
  'Bharani': 'You bear the weight of change, create with passionate intensity and rise transformed. Your journey is one of fire and rebirth.',
  'Krittika': 'You cut through illusion with laser-like focus, speak truth with courage and shape destiny. Your will is a sacred fire.',
  'Rohini': 'You attract beauty like a magnetic force, nurture life and flourish. Your presence is a garden of fertility and charm.',
  'Mrigashira': 'You chase the silver deer, ask the deep questions and search the wild. Your curiosity is a sacred quest.',
  'Ardra': 'You cry the tears of clearing storms, stand resilient in trials and transform the dark. Your strength is forged in truth.',
  'Punarvasu': 'You return with the arrow of light, renew what was lost and find hope. Your path is a cycle of eternal return.',
  'Pushya': 'You flow like warm milk, nurture with infinite grace and stand as a guide. Your soul is a sanctuary of protection.',
  'Ashlesha': 'You see through the hidden veils, bind with magnetic intensity and rise wise. Your intuition is a deep serpent pool.',
  'Magha': 'You carry the mantle of ancestors, rule with a generous heart and stand proud. Your honor is a royal crest.',
  'Purva Phalguni': 'You rest in the shade of joy, love with playful warmth and create art. Your life is a celebration of ease.',
  'Uttara Phalguni': 'You stand by your solemn word, serve with devoted love and guide families. Your friendship is a lifetime covenant.',
  'Hasta': 'You mold reality with clever hands, speak with sparkling wit and play. Your dexterity is a craft of pure magic.',
  'Chitra': 'You design diamonds from dust, shine with dazzling charm and build wonders. Your eye is a lens of absolute beauty.',
  'Swati': 'You float like a solitary leaf in the breeze, seek absolute freedom and think fair. Your independence is your strength.',
  'Vishakha': 'You target the golden gate, compete with relentless power and win. Your triumph is written in your patience.',
  'Anuradha': 'You build bridges across oceans, remain loyal through ages and seek the divine. Your love is a devotion of stars.',
  'Jyeshta': 'You protect the sacred lineage, rule with silent power and stand mature. Your wisdom is the crown of the elders.',
  'Mula': 'You pull up the roots of illusion, look into the core truth and rebuild from zero. Your destruction is a clean slate.',
  'Purva Ashadha': 'You conquer the undefeated, shine with endless hope and flow. Your invincibility is born of self-belief.',
  'Uttara Ashadha': 'You stand as a pillar of truth, win with universal alliance and remain quiet. Your virtue is unshakeable.',
  'Shravana': 'You listen to the silent whisper of the cosmos, speak truth and teach. Your mind is a repository of ancient lore.',
  'Dhanishta': 'You march to the drumbeat of prosperity, harmonize opposing forces and build. Your soul is a symphony of rhythm.',
  'Shatabhisha': 'You heal with a hundred secret herbs, look into the dark void and know. Your path is a mystery of restoration.',
  'Purva Bhadrapada': 'You burn with double fire, dream of the deep cosmos and stand apart. Your journey is a bridge of stars.',
  'Uttara Bhadrapada': 'You sleep in the cosmic ocean, watch the worlds turn and protect. Your peace is a silent mountain.',
  'Revati': 'You guide the lost traveler home, protect the small and love all. Your compass is a direct link to the divine.',
};

// ── Nakshatra name normalization ────────────────────────────────────────────
// AstrologyAPI returns transliteration variants (e.g. "Uttra Phalguni",
// "Vishaka", "Moola") that don't match our canonical dictionary keys. Map them
// to the 27 canonical names so taglines/traits/descriptions resolve correctly.
const NAKSHATRA_CANONICAL = Object.keys(NAKSHATRA_TAGLINES);
const nkKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const NAKSHATRA_CANON_MAP: Record<string, string> = NAKSHATRA_CANONICAL.reduce(
  (acc, name) => {
    acc[nkKey(name)] = name;
    return acc;
  },
  {} as Record<string, string>
);
const NAKSHATRA_ALIASES: Record<string, string> = {
  aswini: 'Ashwini',
  kritika: 'Krittika',
  mrigasira: 'Mrigashira', mrigashirsha: 'Mrigashira', mrighashira: 'Mrigashira',
  aardra: 'Ardra', arudra: 'Ardra',
  pushyami: 'Pushya', pushyam: 'Pushya',
  aslesha: 'Ashlesha', ashleshaa: 'Ashlesha',
  poorvaphalguni: 'Purva Phalguni', purvafalguni: 'Purva Phalguni', pubba: 'Purva Phalguni',
  uttraphalguni: 'Uttara Phalguni', uttarafalguni: 'Uttara Phalguni', uttra: 'Uttara Phalguni',
  swathi: 'Swati',
  vishaka: 'Vishakha', visakha: 'Vishakha',
  jyeshtha: 'Jyeshta', jestha: 'Jyeshta', jyestha: 'Jyeshta',
  moola: 'Mula',
  poorvashada: 'Purva Ashadha', purvashadha: 'Purva Ashadha', purvasadha: 'Purva Ashadha', poorvaashada: 'Purva Ashadha',
  uttarashada: 'Uttara Ashadha', uttarashadha: 'Uttara Ashadha', uttarasadha: 'Uttara Ashadha', uttaraashada: 'Uttara Ashadha',
  sravana: 'Shravana', shravan: 'Shravana',
  dhanistha: 'Dhanishta', dhanista: 'Dhanishta',
  sathabhisha: 'Shatabhisha', shatabhishak: 'Shatabhisha', satabhisha: 'Shatabhisha', shatataraka: 'Shatabhisha',
  poorvabhadrapada: 'Purva Bhadrapada', purvabhadra: 'Purva Bhadrapada', poorvabhadra: 'Purva Bhadrapada',
  uttarabhadrapada: 'Uttara Bhadrapada', uttarabhadra: 'Uttara Bhadrapada',
  revathi: 'Revati',
};

const titleCaseWords = (s: string) =>
  s.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const normalizeNakshatra = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const key = nkKey(raw);
  if (!key) return null;
  return NAKSHATRA_CANON_MAP[key] || NAKSHATRA_ALIASES[key] || titleCaseWords(raw);
};

const getZodiacTagline = (type: 'western' | 'vedic' | 'nakshatra', signName: string | null | undefined): string => {
  if (!signName) return '';
  const name = signName.trim();
  const formatted = formatSignLabel(name);

  if (type === 'western') {
    const wName = getWesternSignName(name) || name;
    const wFormatted = formatSignLabel(wName);
    return WESTERN_TAGLINES[wName] || WESTERN_TAGLINES[wFormatted || ''] || '';
  } else if (type === 'vedic') {
    const vName = getVedicSignName(name) || name;
    const vFormatted = formatSignLabel(vName);
    return VEDIC_TAGLINES[vName] || VEDIC_TAGLINES[vFormatted || ''] || '';
  } else if (type === 'nakshatra') {
    return NAKSHATRA_TAGLINES[name] || NAKSHATRA_TAGLINES[formatted || ''] || '';
  }
  return '';
};

const getZodiacTraits = (type: 'western' | 'vedic' | 'nakshatra', signName: string | null | undefined): string[] => {
  if (!signName) return [];
  const name = signName.trim();
  const formatted = formatSignLabel(name);

  if (type === 'western') {
    const wName = getWesternSignName(name) || name;
    const wFormatted = formatSignLabel(wName);
    return WESTERN_TRAITS[wName] || WESTERN_TRAITS[wFormatted || ''] || [];
  } else if (type === 'vedic') {
    const vName = getVedicSignName(name) || name;
    const vFormatted = formatSignLabel(vName);
    return VEDIC_TRAITS[vName] || VEDIC_TRAITS[vFormatted || ''] || [];
  } else if (type === 'nakshatra') {
    return NAKSHATRA_TRAITS[name] || NAKSHATRA_TRAITS[formatted || ''] || [];
  }
  return [];
};

const getPersonalityDescription = (type: 'western' | 'vedic' | 'nakshatra', signName: string | null | undefined): string | null => {
  if (!signName) return null;

  const name = signName.trim();
  const formatted = formatSignLabel(name);

  if (type === 'western') {
    const wName = getWesternSignName(name) || name;
    const wFormatted = formatSignLabel(wName);
    return WESTERN_DESCRIPTIONS[wName] || WESTERN_DESCRIPTIONS[wFormatted || ''] || null;
  } else if (type === 'vedic') {
    const vName = getVedicSignName(name) || name;
    const vFormatted = formatSignLabel(vName);
    return VEDIC_DESCRIPTIONS[vName] || VEDIC_DESCRIPTIONS[vFormatted || ''] || null;
  } else if (type === 'nakshatra') {
    return NAKSHATRA_DESCRIPTIONS[name] || NAKSHATRA_DESCRIPTIONS[formatted || ''] || null;
  }

  return null;
};

const enqueueSynastryPrewarm = (userId: string) => {
  void (async () => {
    try {
      const { data, error } = await supabase.rpc('enqueue_synastry_prewarm', { p_user_id: userId });

      if (error) {
        console.warn('Synastry prewarm enqueue failed:', error.message);
        return;
      }

      console.log('Synastry prewarm enqueue requested:', data);

      const { error: invokeError } = await supabase.functions.invoke('process-synastry-prewarm', {
        body: { batch_size: 10 },
      });

      if (invokeError) {
        console.warn('Synastry prewarm processor trigger failed:', invokeError.message);
      }
    } catch (error: unknown) {
      console.warn(
        'Synastry prewarm enqueue threw:',
        error instanceof Error ? error.message : String(error)
      );
    }
  })();
};

const getVedicSymbol = (signName: string | null | undefined): string => {
  if (!signName) return '♈';
  const sign = signName.toLowerCase().trim();

  if (sign.includes('mesha') || sign.includes('aries')) return '♈';
  if (sign.includes('vrishabha') || sign.includes('taurus')) return '♉';
  if (sign.includes('mithuna') || sign.includes('gemini')) return '♊';
  if (sign.includes('karka') || sign.includes('cancer')) return '♋';
  if (sign.includes('simha') || sign.includes('leo')) return '♌';
  if (sign.includes('kanya') || sign.includes('virgo')) return '♍';
  if (sign.includes('tula') || sign.includes('libra')) return '♎';
  if (sign.includes('vrishchika') || sign.includes('scorpio')) return '♏';
  if (sign.includes('dhanu') || sign.includes('sagittarius')) return '♐';
  if (sign.includes('makara') || sign.includes('capricorn')) return '♑';
  if (sign.includes('kumbha') || sign.includes('aquarius')) return '♒';
  if (sign.includes('meena') || sign.includes('pisces')) return '♓';

  return '♈';
};

const getElementGradient = (element?: string | null): readonly [string, string] => {
  const el = element?.toLowerCase().trim();
  if (el === 'fire') return ['#FF416C', '#FF4B2B'];
  if (el === 'earth') return ['#11998e', '#38ef7d'];
  if (el === 'air') return ['#00c6ff', '#0072ff'];
  if (el === 'water') return ['#f857a6', '#ff5858'];
  return ['#A855F7', '#EC4899']; // default purple-pink gradient
};

const COLORS = {
  background: '#0B0613',
  ink: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  accent: '#7C3AED',
};

export default function ZodiacPreviewScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [selectedZodiacType, setSelectedZodiacType] = useState<'vedic' | 'western' | 'nakshatra'>('vedic');

  // Birth details + computed astro data, loaded from the DB (and computed live
  // from the zodiac API when the cached Vedic fields are missing).
  const [loadingAstro, setLoadingAstro] = useState(true);
  const [dob, setDob] = useState<Date | null>(null);
  const [tob, setTob] = useState<Date | null>(null);
  const [pob, setPob] = useState<string>('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [birthTz, setBirthTz] = useState<string | undefined>(undefined);
  const [astroData, setAstroData] = useState<any>(null);

  // Animation values for transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const nameFadeAnim = useRef(new Animated.Value(1)).current;
  const descFadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // ── Load birth details + astro data ──────────────────────────────────────
  // Primary source is the saved `astro_details` row. When the Vedic fields
  // (indian_sign / nakshatra_name) are missing we compute them live from the
  // zodiac API, resolving the birth place via the geo endpoint and the
  // DST-correct timezone, then cache the result back to the DB.
  useEffect(() => {
    let cancelled = false;

    const parseTob = (dateStr: string, timeStr?: string | null): Date => {
      const base = new Date(dateStr);
      if (timeStr) {
        const [h, m, s] = timeStr.split(':').map((n) => parseInt(n, 10));
        base.setHours(h || 0, m || 0, s || 0, 0);
      }
      return base;
    };

    (async () => {
      try {
        // Allow navigation params to override the DB (e.g. a live preview flow).
        const paramDob = params.dob ? new Date(params.dob as string) : null;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user && !paramDob) {
          if (!cancelled) setLoadingAstro(false);
          return;
        }

        let row: any = null;
        if (user) {
          const { data } = await supabase
            .from('astro_details')
            .select('birth_date, birth_time, birth_location, birth_latitude, birth_longitude, birth_timezone, western_sign, indian_sign, nakshatra_name, venus_sign, mars_sign, mercury_sign, rising_sign, dominant_element, chart_json')
            .eq('user_id', user.id)
            .single();
          row = data;
        }

        const birthDateStr = (params.dob as string) || row?.birth_date;
        if (!birthDateStr) {
          if (!cancelled) setLoadingAstro(false);
          return;
        }

        const birthTimeStr = (params.tob as string) || row?.birth_time || null;
        const resolvedDob = new Date(birthDateStr);
        const resolvedTob = parseTob(birthDateStr, birthTimeStr);
        let resolvedLat: number | undefined =
          (params.lat ? parseFloat(params.lat as string) : undefined) ??
          (row?.birth_latitude ?? undefined);
        let resolvedLng: number | undefined =
          (params.lng ? parseFloat(params.lng as string) : undefined) ??
          (row?.birth_longitude ?? undefined);
        const resolvedPob = (params.pob as string) || row?.birth_location || '';
        const resolvedTzName = (params.tz as string) || row?.birth_timezone || undefined;

        if (!cancelled) {
          setDob(resolvedDob);
          setTob(resolvedTob);
          setPob(resolvedPob);
          setLat(resolvedLat);
          setLng(resolvedLng);
          setBirthTz(resolvedTzName);
        }

        // Seed with any cached computed fields already on the row.
        let computed: any = row
          ? {
              western_sign: row.western_sign,
              indian_sign: row.indian_sign,
              nakshatra_name: row.nakshatra_name,
              venus_sign: row.venus_sign,
              mars_sign: row.mars_sign,
              mercury_sign: row.mercury_sign,
              rising_sign: row.rising_sign,
              dominant_element: row.dominant_element,
              chart_json: row.chart_json,
            }
          : {};

        // Resolve coordinates via the geo endpoint if we don't have them,
        // with a device-geocoder fallback for colloquial/short place names.
        if ((resolvedLat == null || resolvedLng == null) && resolvedPob) {
          const results = await searchBirthPlace(resolvedPob);
          if (results && results.length > 0) {
            resolvedLat = results[0].latitude;
            resolvedLng = results[0].longitude;
          } else {
            try {
              const geo = await Location.geocodeAsync(resolvedPob);
              if (geo && geo.length > 0) {
                resolvedLat = geo[0].latitude;
                resolvedLng = geo[0].longitude;
              }
            } catch (geoErr) {
              console.warn('Device geocode fallback failed:', geoErr);
            }
          }
        }

        // Whenever we can resolve coordinates, (re)compute from the API using the
        // DST-correct timezone. Nakshatra is highly sensitive to the timezone, so
        // we don't trust a cached value that may predate an accurate tzone; we only
        // fall back to the cache if coordinates or the API are unavailable.
        if (resolvedLat != null && resolvedLng != null) {
          let tzOffset = await getTimezoneOffset(resolvedLat, resolvedLng, resolvedDob);
          if (tzOffset == null) {
            tzOffset = parseTzString(
              resolvedTzName || Intl.DateTimeFormat().resolvedOptions().timeZone || 'GMT'
            );
          }

          const fresh = await getAstroDetails({
            day: resolvedDob.getDate(),
            month: resolvedDob.getMonth() + 1,
            year: resolvedDob.getFullYear(),
            hour: resolvedTob.getHours(),
            min: resolvedTob.getMinutes(),
            lat: resolvedLat,
            lon: resolvedLng,
            tzone: tzOffset,
            mode: 'basic',
          });

          if (fresh && (fresh.indian_sign || fresh.nakshatra_name || fresh.western_sign)) {
            computed = { ...computed, ...fresh };
            // Cache the computed values back to the DB (best-effort).
            if (user) {
              void supabase
                .from('astro_details')
                .update({
                  birth_latitude: resolvedLat,
                  birth_longitude: resolvedLng,
                  western_sign: fresh.western_sign ?? null,
                  indian_sign: fresh.indian_sign ?? null,
                  nakshatra_name: fresh.nakshatra_name ?? null,
                  venus_sign: fresh.venus_sign ?? null,
                  mars_sign: fresh.mars_sign ?? null,
                  mercury_sign: fresh.mercury_sign ?? null,
                  rising_sign: fresh.rising_sign ?? null,
                  dominant_element: fresh.dominant_element ?? null,
                  chart_json: fresh.chart_json ?? null,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id);
            }
          }
        }

        if (!cancelled) {
          setLat(resolvedLat);
          setLng(resolvedLng);
          setAstroData(computed);
        }
      } catch (err) {
        console.warn('Failed to load cosmic identity data:', err);
      } finally {
        if (!cancelled) setLoadingAstro(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.dob, params.tob, params.pob, params.lat, params.lng, params.tz]);

  // Animate planet card when zodiac type changes
  useEffect(() => {
    // Reset animation values
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    rotateAnim.setValue(0);
    nameFadeAnim.setValue(0);
    descFadeAnim.setValue(0);
    slideAnim.setValue(-20);

    // Staggered animations: Planet circle first
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Then name slides in and fades
    Animated.parallel([
      Animated.timing(nameFadeAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Finally description fades in
    Animated.timing(descFadeAnim, {
      toValue: 1,
      duration: 400,
      delay: 400,
      useNativeDriver: true,
    }).start();
  }, [selectedZodiacType, fadeAnim, scaleAnim, rotateAnim, nameFadeAnim, descFadeAnim, slideAnim]);

  // Continuous pulse animation for planet circle
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [pulseAnim]);

  const westernSign = useMemo(() => (dob ? getWesternSign(dob) : null), [dob]);

  const indianSignName =
    astroData?.indian_sign ||
    astroData?.vedic_sign ||
    astroData?.sign ||
    astroData?.Sign ||
    astroData?.moon_sign ||
    astroData?.sun_sign ||
    null;

  const indianElement =
    astroData?.indian_element ||
    astroData?.vedic_element ||
    astroData?.tatva ||
    astroData?.element ||
    astroData?.Element ||
    null;

  const astroNakshatraName = normalizeNakshatra(
    astroData?.nakshatra?.name ||
    astroData?.nakshatra_name ||
    astroData?.Naksahtra ||
    astroData?.nakshatra ||
    null
  );

  const astroNakshatraSymbol =
    astroData?.nakshatra?.symbol ||
    astroData?.nakshatra_symbol ||
    '✨';

  const nakshatra = astroNakshatraName
    ? {
      name: astroNakshatraName,
      symbol: astroNakshatraSymbol,
    }
    : null;

  const activeSign = useMemo(() => {
    if (selectedZodiacType === 'vedic') {
      let el = indianElement;
      if (!el && indianSignName) {
        const sign = indianSignName.toLowerCase().trim();
        if (sign.includes('mesha') || sign.includes('aries') || sign.includes('simha') || sign.includes('leo') || sign.includes('dhanu') || sign.includes('sagittarius')) {
          el = 'Fire';
        } else if (sign.includes('vrishabha') || sign.includes('taurus') || sign.includes('kanya') || sign.includes('virgo') || sign.includes('makara') || sign.includes('capricorn')) {
          el = 'Earth';
        } else if (sign.includes('mithuna') || sign.includes('gemini') || sign.includes('tula') || sign.includes('libra') || sign.includes('kumbha') || sign.includes('aquarius')) {
          el = 'Air';
        } else {
          el = 'Water';
        }
      }
      const vedicSignName = getVedicSignName(indianSignName);
      const westernSignName = getWesternSignName(indianSignName);
      const info = getSignInfo(westernSignName);
      return {
        name: vedicSignName ? formatSignLabel(vedicSignName) : 'Vedic Sign',
        symbol: getVedicSymbol(indianSignName),
        image: getSignImage(indianSignName),
        element: el,
        dates: info?.dates ?? null,
        ruler: info?.ruler ?? null,
        rulerSymbol: info?.rulerSymbol ?? null,
        tagline: getZodiacTagline('vedic', vedicSignName),
        traits: getZodiacTraits('vedic', vedicSignName),
        description: getPersonalityDescription('vedic', vedicSignName) || '',
      };
    } else if (selectedZodiacType === 'western') {
      const info = getSignInfo(westernSign?.name);
      return {
        name: westernSign?.name || 'Western Sign',
        symbol: westernSign?.symbol || '♈',
        image: getSignImage(westernSign?.name),
        element: westernSign?.element || 'Fire',
        dates: info?.dates ?? null,
        ruler: info?.ruler ?? null,
        rulerSymbol: info?.rulerSymbol ?? null,
        tagline: getZodiacTagline('western', westernSign?.name),
        traits: getZodiacTraits('western', westernSign?.name),
        description: getPersonalityDescription('western', westernSign?.name) || '',
      };
    } else {
      return {
        name: nakshatra?.name || 'Nakshatra',
        symbol: nakshatra?.symbol || '✨',
        image: getNakshatraImage(nakshatra?.name),
        element: 'Celestial',
        dates: null as string | null,
        ruler: null as string | null,
        rulerSymbol: null as string | null,
        tagline: getZodiacTagline('nakshatra', nakshatra?.name),
        traits: getZodiacTraits('nakshatra', nakshatra?.name),
        description: getPersonalityDescription('nakshatra', nakshatra?.name) || '',
      };
    }
  }, [selectedZodiacType, indianSignName, indianElement, westernSign, nakshatra]);

  const cardImageSource = useMemo(() => {
    if (selectedZodiacType === 'nakshatra') {
      return getNakshatraImage(activeSign?.name);
    }
    return getSignImage(activeSign?.name);
  }, [selectedZodiacType, activeSign]);


  const handleContinue = async () => {
    if (hasSaved) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const birthTime = tob
        ? `${String(tob.getHours()).padStart(2, '0')}:${String(tob.getMinutes()).padStart(2, '0')}:${String(tob.getSeconds()).padStart(2, '0')}`
        : '00:00:00'; // HH:MM:SS

      // Persist the finalized identity (loader already cached computed fields;
      // this makes sure the locally-derived western sign is stored too).
      const { data, error } = await supabase
        .from('astro_details')
        .upsert(
          {
            user_id: user.id,
            birth_date: dob ? dob.toISOString().split('T')[0] : undefined,
            birth_time: birthTime,
            birth_location: pob || undefined,
            birth_latitude: lat ?? undefined,
            birth_longitude: lng ?? undefined,
            birth_timezone: birthTz || undefined,
            western_sign: westernSign?.name || undefined,
            indian_sign: indianSignName || undefined,
            nakshatra_name: astroNakshatraName || undefined,
            venus_sign: astroData?.venus_sign || undefined,
            mars_sign: astroData?.mars_sign || undefined,
            mercury_sign: astroData?.mercury_sign || undefined,
            rising_sign: astroData?.rising_sign || undefined,
            dominant_element: astroData?.dominant_element || undefined,
            chart_json: astroData?.chart_json || undefined,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('user_id')
        .single();

      if (error) throw error;

      console.log('✨ Astro details saved successfully');
      setHasSaved(true);
      if (data?.user_id) {
        enqueueSynastryPrewarm(data.user_id);
      }
      router.replace('/onboarding-ques-01');
    } catch (error) {
      console.error('❌ Error saving astro details:', error);
      Alert.alert('Error', 'Failed to save your details. Please try again.');
      setIsSaving(false);
    }
  };


  if (loadingAstro) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <ActivityIndicator size="large" color={COLORS.ink} />
            <Text style={[styles.errorText, { marginTop: 16, fontSize: 15 }]}>Reading your stars…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!dob || !westernSign) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Invalid birth details</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }
  return (
    <ImageBackground
      source={require('@/assets/images/onboard-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Background Sparkles */}
      <Sparkle size={14} color="rgba(168, 85, 247, 0.15)" style={[styles.bgSparkle, { top: 80, left: 30 }]} />
      <Sparkle size={16} color="rgba(168, 85, 247, 0.1)" style={[styles.bgSparkle, { top: 120, right: 40 }]} />
      <Sparkle size={12} color="rgba(168, 85, 247, 0.15)" style={[styles.bgSparkle, { bottom: 180, left: 45 }]} />
      <Sparkle size={15} color="rgba(168, 85, 247, 0.1)" style={[styles.bgSparkle, { bottom: 100, right: 35 }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Sparkle size={18} color="#A855F7" style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>
                Your Cosmic <Text style={styles.headerTitleAccent}>Identity</Text>
              </Text>
              <Sparkle size={18} color="#A855F7" style={{ marginLeft: 8 }} />
            </View>
            <Text style={styles.headerSubtitle}>Discover your signs</Text>
          </View>

          {/* Zodiac Type Toggle */}
          <View style={styles.toggleContainer}>
            <GradientView
              colors={['#1A0B2E', '#2D1B4E', '#4A2C5A']}
              angle={135}
              style={styles.toggleBackground}
            >
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  selectedZodiacType === 'vedic' && styles.toggleOptionActive,
                  !indianSignName && styles.toggleOptionDisabled,
                ]}
                onPress={() => setSelectedZodiacType('vedic')}
                disabled={!indianSignName}
                activeOpacity={0.7}
              >
                <View style={styles.toggleOptionContent}>
                  <Text style={[styles.toggleGlyph, selectedZodiacType === 'vedic' && styles.toggleGlyphActive]}>✦</Text>
                  <Text
                    style={[
                      styles.toggleOptionText,
                      selectedZodiacType === 'vedic' && styles.toggleOptionTextActive,
                      !indianSignName && styles.toggleTextDisabled,
                    ]}
                  >
                    Vedic
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  selectedZodiacType === 'western' && styles.toggleOptionActive,
                  !westernSign && styles.toggleOptionDisabled,
                ]}
                onPress={() => setSelectedZodiacType('western')}
                disabled={!westernSign}
                activeOpacity={0.7}
              >
                <View style={styles.toggleOptionContent}>
                  <Text style={[styles.toggleGlyph, selectedZodiacType === 'western' && styles.toggleGlyphActive]}>☾</Text>
                  <Text
                    style={[
                      styles.toggleOptionText,
                      selectedZodiacType === 'western' && styles.toggleOptionTextActive,
                      !westernSign && styles.toggleTextDisabled,
                    ]}
                  >
                    Western
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  selectedZodiacType === 'nakshatra' && styles.toggleOptionActive,
                  !nakshatra && styles.toggleOptionDisabled,
                ]}
                onPress={() => setSelectedZodiacType('nakshatra')}
                disabled={!nakshatra}
                activeOpacity={0.7}
              >
                <View style={styles.toggleOptionContent}>
                  <Text style={[styles.toggleGlyph, selectedZodiacType === 'nakshatra' && styles.toggleGlyphActive]}>☀</Text>
                  <Text
                    style={[
                      styles.toggleOptionText,
                      selectedZodiacType === 'nakshatra' && styles.toggleOptionTextActive,
                      !nakshatra && styles.toggleTextDisabled,
                    ]}
                  >
                    Nakshatra
                  </Text>
                </View>
              </TouchableOpacity>
            </GradientView>
          </View>

          {/* Glowing Minimalist Zodiac Astrolabe Dial */}
          <View style={styles.planetCardContainer}>
            <GradientView
              colors={['rgba(26, 11, 46, 0.75)', 'rgba(45, 27, 78, 0.75)', 'rgba(74, 44, 90, 0.75)']}
              angle={180}
              style={styles.planetCard}
            >
              {/* Star sparkles inside the card */}
              <Sparkle size={14} color="#A855F7" style={styles.starTopLeft} />
              <Sparkle size={12} color="rgba(168, 85, 247, 0.6)" style={styles.starTopRight} />
              <Sparkle size={10} color="#D946EF" style={styles.starBottomLeft} />
              <Sparkle size={13} color="rgba(217, 70, 239, 0.5)" style={styles.starBottomRight} />

              {/* Center Graphic: Image artwork if available, otherwise fallback to astrolabe vector dial */}
              {cardImageSource ? (
                <Animated.View
                  style={[
                    styles.cardImageContainer,
                    {
                      opacity: fadeAnim,
                      transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
                    },
                  ]}
                >
                  <Image
                    source={cardImageSource}
                    style={styles.cardImage}
                    contentFit="contain"
                  />
                </Animated.View>
              ) : (
                <View style={styles.dialContainer}>
                  {/* Thin dial circle line */}
                  <View style={styles.dialCircle} />

                  {/* Central vertical line pointing to active sign at top */}
                  <View style={styles.dialActiveLine} />

                  {/* 12 Zodiac symbols distributed clockwise around the dial */}
                  {ZODIAC_ORDER.map((signName, idx) => {
                    const isSignActive = signName.toLowerCase() === activeSign?.name?.toLowerCase();
                    const sign = WESTERN_SIGNS.find((s) => s.name === signName);
                    if (!sign) return null;

                    const activeIdx = ZODIAC_ORDER.findIndex(
                      (s) => s.toLowerCase() === activeSign?.name?.toLowerCase()
                    );
                    const diff = (idx - activeIdx + 12) % 12;
                    const theta = (diff * 30 - 90) * (Math.PI / 180);

                    const r = 96;
                    const x = 130 + r * Math.cos(theta) - 12;
                    const y = 130 + r * Math.sin(theta) - 12;

                    return (
                      <View
                        key={signName}
                        style={[
                          styles.dialSymbolWrapper,
                          { left: x, top: y },
                          isSignActive && styles.dialSymbolActiveWrapper,
                        ]}
                      >
                        <Text style={[styles.dialSymbolText, isSignActive && styles.dialSymbolActiveText]}>
                          {sign.symbol}
                        </Text>
                      </View>
                    );
                  })}

                  {/* Central Glowing 3D Pink Sphere */}
                  <Animated.View
                    style={[
                      styles.pinkSphereContainer,
                      { transform: [{ scale: scaleAnim }] },
                    ]}
                  >
                    <GradientView colors={['#EC4899', '#BE185D']} angle={135} style={styles.pinkSphereFill}>
                      {/* 3D Gloss Highlight Overlay */}
                      <View style={styles.sphereGloss} />

                      {/* Sign Glyph Symbol */}
                      <Text style={styles.sphereSymbolText}>{activeSign?.symbol}</Text>
                    </GradientView>
                  </Animated.View>
                </View>
              )}

              {/* Animated Zodiac Name, Tagline, Traits & Description */}
              <Animated.View
                style={[
                  styles.zodiacNameContainer,
                  {
                    opacity: nameFadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <Text style={styles.zodiacName}>{activeSign?.name}</Text>
                {activeSign?.tagline ? (
                  <Text style={styles.zodiacTagline}>✦ {activeSign?.tagline} ✦</Text>
                ) : null}

                {/* Traits Pill Row - Single Outlined Row */}
                {activeSign?.traits && activeSign.traits.length > 0 ? (
                  <View style={styles.traitsBorderContainer}>
                    <Text style={styles.traitsText}>
                      {activeSign.traits.join('  •  ')}
                    </Text>
                  </View>
                ) : null}
              </Animated.View>

              {/* Animated Personality Description */}
              <Animated.View
                style={[styles.personalityDescriptionContainer, { opacity: descFadeAnim }]}
              >
                <Text style={styles.personalityDescription}>
                  {activeSign?.description}
                </Text>
              </Animated.View>
            </GradientView>
          </View>

          {/* Centered Next Button at the Bottom */}
          <View style={styles.bottomNavContainer}>
            <TouchableOpacity
              style={[styles.gradientNextButton, isSaving && styles.gradientNextButtonDisabled]}
              onPress={handleContinue}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              <GradientView
                colors={['#8B5CF6', '#EC4899']}
                angle={135}
                style={styles.gradientNextButtonFill}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.nextButtonChevron}>→</Text>
                )}
              </GradientView>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bgSparkle: {
    position: 'absolute',
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerTitleAccent: {
    color: '#B37CFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  toggleBackground: {
    flexDirection: 'row',
    borderRadius: 30,
    padding: 4,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    backgroundColor: '#15082E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleOptionDisabled: {
    opacity: 0.4,
  },
  toggleOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleGlyph: {
    fontSize: 14,
    marginRight: 5,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  toggleGlyphActive: {
    color: '#4C1D95',
  },
  toggleOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.3,
  },
  toggleOptionTextActive: {
    color: '#4C1D95',
    fontWeight: '700',
  },
  toggleTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  planetCardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  planetCard: {
    width: '100%',
    height: 490,
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  starTopLeft: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 2,
  },
  starTopRight: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 2,
  },
  starBottomLeft: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 2,
  },
  starBottomRight: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 2,
  },
  dialContainer: {
    width: 260,
    height: 260,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  dialCircle: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  dialActiveLine: {
    position: 'absolute',
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    top: 36,
    left: 130,
  },
  dialSymbolWrapper: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialSymbolActiveWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  dialSymbolText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
  },
  dialSymbolActiveText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  pinkSphereContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: 'absolute',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  pinkSphereFill: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sphereGloss: {
    position: 'absolute',
    width: 90,
    height: 40,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    top: 6,
    left: 15,
    transform: [{ rotate: '-15deg' }],
  },
  sphereSymbolText: {
    fontSize: 54,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  zodiacNameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  zodiacName: {
    fontSize: 34,
    fontFamily: SERIF,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  zodiacTagline: {
    fontSize: 15,
    color: '#B088FF',
    marginTop: 4,
    letterSpacing: 1.5,
    textAlign: 'center',
    fontWeight: '600',
  },
  traitsBorderContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  traitsText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
  cardImageContainer: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 110,
  },
  personalityDescriptionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    marginTop: 8,
  },
  personalityDescription: {
    fontSize: 13.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  bottomNavContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  gradientNextButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  gradientNextButtonFill: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientNextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonChevron: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#4B0082',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
