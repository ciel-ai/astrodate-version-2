import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  G,
  Line,
  Text as SvgText,
} from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);

// ︎ is the Unicode text variation selector (VS15).
// It forces the browser/system to render the character as a plain TEXT glyph
// instead of a colorful EMOJI, eliminating the square emoji background boxes.
//
// Order clockwise beginning from the top (12 o'clock), per spec.
const ZODIAC_SIGNS = [
  { name: 'Aries',       glyph: '♈︎' }, // 12 o'clock
  { name: 'Taurus',      glyph: '♉︎' }, //  1 o'clock
  { name: 'Gemini',      glyph: '♊︎' }, //  2 o'clock
  { name: 'Cancer',      glyph: '♋︎' }, //  3 o'clock
  { name: 'Leo',         glyph: '♌︎' }, //  4 o'clock
  { name: 'Virgo',       glyph: '♍︎' }, //  5 o'clock
  { name: 'Libra',       glyph: '♎︎' }, //  6 o'clock
  { name: 'Scorpio',     glyph: '♏︎' }, //  7 o'clock
  { name: 'Sagittarius', glyph: '♐︎' }, //  8 o'clock
  { name: 'Capricorn',   glyph: '♑︎' }, //  9 o'clock
  { name: 'Aquarius',    glyph: '♒︎' }, // 10 o'clock
  { name: 'Pisces',      glyph: '♓︎' }, // 11 o'clock
];

// ────────────────────────────────────────────────────────────────────
// SVG coordinate system: 1000 × 1000 units.
// At WHEEL_SIZE = 310 px (the value passed from index.tsx),
// scale factor = 310/1000 = 0.31
//
// Target on-screen  →  SVG units needed (÷ 0.31)
//   stroke 1.5 px   →  ~5 SVG units
//   stroke 1.0 px   →  ~3 SVG units
//   symbol 30 px    →  ~97 SVG units  (use 90)
//   glow   4 px     →  ~13 SVG units  (use 10 stdDeviation)
// ────────────────────────────────────────────────────────────────────
const SIZE   = 1000;
const CENTER = 500;

const OUTER_RADIUS        = 480; // full wheel edge
const MIDDLE_RADIUS       = 442; // middle ring
const SYMBOL_RADIUS       = 458; // glyphs sit in the outer band
const INNER_RADIUS        = 432; // inner ring — enlarged empty centre, more negative space

const RING_STROKE   = 5;   // → 1.5 px on screen (outer + middle)
const INNER_STROKE  = 3;   // → 1 px on screen (inner ring)
const DIV_STROKE    = 3;   // → 1 px on screen
const SYMBOL_SIZE   = 90;  // → ~26 px on screen — plain, thin glyphs

// Soft violet used throughout — thin, elegant, no glow on the glyphs
const GLYPH_COLOR   = '#8F6DFF';

interface ZodiacWheelProps {
  size?: number;
}

export default function ZodiacWheel({ size = 310 }: ZodiacWheelProps) {
  const [rotateAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 90000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotateAnim]);

  const wheelRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // 12 radial dividers bisecting each 30° segment gap
  const dividers = Array.from({ length: 12 }).map((_, i) => {
    const a = (-90 + 15 + i * 30) * (Math.PI / 180);
    return {
      x1: CENTER + INNER_RADIUS  * Math.cos(a),
      y1: CENTER + INNER_RADIUS  * Math.sin(a),
      x2: CENTER + OUTER_RADIUS  * Math.cos(a),
      y2: CENTER + OUTER_RADIUS  * Math.sin(a),
    };
  });

  // Tiny accent dots (2 per gap, 24 total) at symbol radius
  const accentDots = Array.from({ length: 12 }).flatMap((_, i) => {
    const a1 = (-90 + i * 30 + 10) * (Math.PI / 180);
    const a2 = (-90 + i * 30 + 20) * (Math.PI / 180);
    return [
      { cx: CENTER + SYMBOL_RADIUS * Math.cos(a1), cy: CENTER + SYMBOL_RADIUS * Math.sin(a1) },
      { cx: CENTER + SYMBOL_RADIUS * Math.cos(a2), cy: CENTER + SYMBOL_RADIUS * Math.sin(a2) },
    ];
  });

  // Dots along inner ring every 10° (36 total)
  const innerDots = Array.from({ length: 36 }).map((_, i) => {
    const a = (i * 10) * (Math.PI / 180);
    return {
      cx: CENTER + INNER_RADIUS * Math.cos(a),
      cy: CENTER + INNER_RADIUS * Math.sin(a),
    };
  });

  // Glyph positions: clockwise from Aries at 12 o'clock (-90°).
  // Rendered OUTSIDE the rotating group so symbols stay static and upright.
  const glyphs = ZODIAC_SIGNS.map((sign, index) => {
    const a = (-90 + index * 30) * (Math.PI / 180);
    return {
      ...sign,
      x: CENTER + SYMBOL_RADIUS * Math.cos(a),
      // dy offset for vertical centering (≈ 36% of font size)
      y: CENTER + SYMBOL_RADIUS * Math.sin(a) + SYMBOL_SIZE * 0.36,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={styles.svg}
      >
        <Defs>
          {/* Very soft glow — 4 px target → stdDeviation 10 SVG units */}
          <Filter id="ringGlow" x="-10%" y="-10%" width="120%" height="120%">
            <FeGaussianBlur stdDeviation="10" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
          {/* Even softer for dots */}
          <Filter id="dotGlow" x="-60%" y="-60%" width="220%" height="220%">
            <FeGaussianBlur stdDeviation="5" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        </Defs>

        {/* ── Rings, dividers and dots rotate slowly together ── */}
        <AnimatedG rotation={wheelRotation} originX={CENTER} originY={CENTER}>

          {/* ── Three concentric rings — 1.5 px stroke, 15% opacity, soft glow ── */}
          <Circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS}
            stroke={GLYPH_COLOR} strokeWidth={RING_STROKE}
            fill="none" opacity={0.15}
            filter="url(#ringGlow)" />

          <Circle cx={CENTER} cy={CENTER} r={MIDDLE_RADIUS}
            stroke={GLYPH_COLOR} strokeWidth={RING_STROKE}
            fill="none" opacity={0.15}
            filter="url(#ringGlow)" />

          <Circle cx={CENTER} cy={CENTER} r={INNER_RADIUS}
            stroke={GLYPH_COLOR} strokeWidth={INNER_STROKE}
            fill="none" opacity={0.15}
            filter="url(#ringGlow)" />

          {/* ── 12 radial dividers — 1 px, 6% opacity (almost invisible) ── */}
          {dividers.map((d, idx) => (
            <Line
              key={`div-${idx}`}
              x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
              stroke={GLYPH_COLOR} strokeWidth={DIV_STROKE} opacity={0.06}
            />
          ))}

          {/* ── Tiny accent dots (kept very faint) ── */}
          {accentDots.map((dot, idx) => (
            <G key={`acc-${idx}`}>
              <Circle cx={dot.cx} cy={dot.cy} r={2.5}
                fill="#9B72FF" opacity={0.10} filter="url(#dotGlow)" />
              <Circle cx={dot.cx} cy={dot.cy} r={0.9}
                fill="#D8B4FF" opacity={0.25} />
            </G>
          ))}

          {/* ── Inner ring decorative dots ── */}
          {innerDots.map((dot, idx) => (
            <Circle key={`id-${idx}`}
              cx={dot.cx} cy={dot.cy} r={1.5}
              fill="#C4A0FF" opacity={0.14} />
          ))}

        </AnimatedG>

        {/* ── Zodiac glyphs — static + upright (outside rotating group) ── */}
        {glyphs.map((sign) => (
          <SvgText
            key={sign.name}
            x={sign.x}
            y={sign.y}
            textAnchor="middle"
            fontSize={SYMBOL_SIZE}
            fill={GLYPH_COLOR}
            opacity={0.28}
          >
            {sign.glyph}
          </SvgText>
        ))}

      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
});
