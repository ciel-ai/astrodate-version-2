/**
 * DiscoverCard
 *
 * Dummy/static preview of the redesigned discover profile card: hero photo
 * with a tiered score ring + name overlay, free (Western) vs paid (Vedic)
 * compatibility stats, a Hinge-style basics/attributes card, and a scroll of
 * alternating 1:1 photos and prompts (each likeable on its own) — every
 * prompt is preceded by a photo, never the other way round.
 *
 * Floating panels use expo-glass-effect's GlassView for real iOS 26 Liquid
 * Glass; it renders as a plain View elsewhere, so the rgba/border styling
 * below doubles as the fallback look on Android and older iOS.
 *
 * Placeholder data only — swap DUMMY_PROFILE for the real feed profile once
 * the layout is signed off.
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { GlassView } from 'expo-glass-effect';

import { getScoreTier } from '@/lib/score-tier';
import { CompatibilitySection } from '@/components/compatibility/CompatibilitySection';

interface PromptBlock {
  type: 'prompt';
  id: string;
  title: string;
  text: string;
}
interface PhotoBlock {
  type: 'photo';
  id: string;
  label: string;
}
type ContentBlock = PromptBlock | PhotoBlock;

interface AttributeRow {
  icon: string;
  label: string;
}

interface DummyProfile {
  name: string;
  age: number;
  verified: boolean;
  zodiac: string;
  distanceLabel: string;
  score: number;
  western: number;
  vedic: { value: number; max: number; doshaFlagged: boolean };
  basics: { age: number; gender: string; orientation: string };
  attributes: AttributeRow[];
  content: ContentBlock[];
}

const DUMMY_PROFILE: DummyProfile = {
  name: 'Ananya',
  age: 27,
  verified: true,
  zodiac: 'Sagittarius',
  distanceLabel: '4 km away',
  score: 87,
  western: 82,
  vedic: { value: 30, max: 36, doshaFlagged: true },
  basics: { age: 27, gender: 'Woman', orientation: 'Straight' },
  attributes: [
    { icon: '💼', label: 'Product designer' },
    { icon: '📖', label: 'Hindu' },
    { icon: '🏠', label: 'Bengaluru' },
    { icon: '🌍', label: 'South Asian' },
    { icon: '🔎', label: 'Long-term relationship' },
    { icon: '👥', label: 'Monogamy' },
  ],
  // Hero photo counts as photo 1 of 6; photos 2-6 are below.
  content: [
    { type: 'photo', id: 'ph2', label: 'AN' },
    {
      type: 'prompt',
      id: 'p1',
      title: 'Two truths and a lie',
      text: 'I have climbed a Himalayan peak, I speak fluent Sanskrit, and I cannot cook Maggi to save my life.',
    },
    { type: 'photo', id: 'ph3', label: 'AN' },
    { type: 'photo', id: 'ph4', label: 'AN' },
    {
      type: 'prompt',
      id: 'p2',
      title: 'I geek out on',
      text: 'Astrology charts, indie playlists, and finding the best filter coffee in every city I visit.',
    },
    { type: 'photo', id: 'ph5', label: 'AN' },
    {
      type: 'prompt',
      id: 'p3',
      title: "I'm looking for",
      text: "Someone who's my calm in chaos, believes in old-school values, and wants to build a life full of meaning (and travel).",
    },
    { type: 'photo', id: 'ph6', label: 'AN' },
  ],
};

function ScoreRing({ score }: { score: number }) {
  const size = 58;
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const tier = getScoreTier(score);
  const progress = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <GlassView glassEffectStyle="clear" style={styles.ringGlass}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tier.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress}, ${circumference}`}
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringScore}>{score}</Text>
        <Text style={[styles.ringLabel, { color: tier.color }]}>{tier.label}</Text>
      </View>
    </GlassView>
  );
}

function HeartButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={active ? 'Unlike this prompt' : 'Like this prompt'}>
      {({ pressed }) => (
        <GlassView
          glassEffectStyle="clear"
          isInteractive
          style={[styles.heartBtn, pressed && styles.heartBtnPressed]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
              stroke={active ? '#FF5CA8' : '#C9A6E8'}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill={active ? '#FF5CA8' : 'none'}
            />
          </Svg>
        </GlassView>
      )}
    </Pressable>
  );
}

export function DiscoverCard() {
  const profile = DUMMY_PROFILE;
  const [likedPrompts, setLikedPrompts] = useState<Record<string, boolean>>({});

  const toggleLike = (id: string) =>
    setLikedPrompts((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <View style={styles.card}>
      {/* Hero photo */}
      <View style={styles.hero}>
        <Text style={styles.heroInitials}>{profile.name.slice(0, 2).toUpperCase()}</Text>

        <View style={styles.scoreOverlay}>
          <ScoreRing score={profile.score} />
        </View>

        <View style={styles.nameOverlay}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {profile.name}, {profile.age}
            </Text>
            {profile.verified && <Text style={styles.verifiedBadge}>✓</Text>}
          </View>
          <Text style={styles.subInfo}>
            {profile.zodiac} · {profile.distanceLabel}
          </Text>
        </View>
      </View>

      {/* Compatibility — free (Western) vs paid (Vedic) */}
      <View style={styles.statsSection}>
        <CompatibilitySection
          western={{ score: profile.western, caption: 'Sun compatibility' }}
          vedic={{ score: profile.vedic.value, max: profile.vedic.max, doshaFlagged: profile.vedic.doshaFlagged }}
        />
      </View>

      {/* Basics + attributes — Hinge-style info card */}
      <GlassView glassEffectStyle="regular" style={styles.basicsCard}>
        <View style={styles.basicsRow}>
          <View style={styles.basicsChip}>
            <Text style={styles.basicsIcon}>🎂</Text>
            <Text style={styles.basicsText}>{profile.basics.age}</Text>
          </View>
          <View style={styles.basicsDivider} />
          <View style={styles.basicsChip}>
            <Text style={styles.basicsIcon}>🧑</Text>
            <Text style={styles.basicsText}>{profile.basics.gender}</Text>
          </View>
          <View style={styles.basicsDivider} />
          <View style={styles.basicsChip}>
            <Text style={styles.basicsIcon}>🧭</Text>
            <Text style={styles.basicsText}>{profile.basics.orientation}</Text>
          </View>
        </View>

        {profile.attributes.map((attr) => (
          <View key={attr.label} style={styles.attributeRow}>
            <Text style={styles.attributeIcon}>{attr.icon}</Text>
            <Text style={styles.attributeText}>{attr.label}</Text>
          </View>
        ))}
      </GlassView>

      {/* Hinge-style interwoven photos + prompts — every prompt is preceded by a photo */}
      {profile.content.map((block) =>
        block.type === 'prompt' ? (
          <GlassView key={block.id} glassEffectStyle="regular" style={styles.promptCard}>
            <View style={styles.promptText}>
              <Text style={styles.promptTitle}>✦ {block.title}</Text>
              <Text style={styles.promptBody}>{block.text}</Text>
            </View>
            <HeartButton active={!!likedPrompts[block.id]} onPress={() => toggleLike(block.id)} />
          </GlassView>
        ) : (
          <View key={block.id} style={styles.squarePhoto}>
            <Text style={styles.squarePhotoInitials}>{block.label}</Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },

  // ── Hero ──
  hero: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 15, 60, 0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroInitials: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: 2,
  },
  scoreOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  ringGlass: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringScore: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', lineHeight: 18 },
  ringLabel: { fontSize: 7, fontWeight: '700', letterSpacing: 0.3 },

  nameOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 14,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  verifiedBadge: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: '#3B82F6',
    width: 18,
    height: 18,
    lineHeight: 18,
    textAlign: 'center',
    borderRadius: 9,
    overflow: 'hidden',
  },
  subInfo: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', marginTop: 2 },

  // ── Compatibility ──
  statsSection: { marginTop: 12 },

  // ── Basics + attributes ──
  basicsCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  basicsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  basicsChip: { flex: 1, alignItems: 'center', gap: 4 },
  basicsIcon: { fontSize: 16 },
  basicsText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  basicsDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  attributeIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  attributeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },

  // ── Prompt cards ──
  promptCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#6A3FE0', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 14px rgba(106,63,224,0.15)' } as any,
    }),
  },
  promptText: { flex: 1, gap: 6 },
  promptTitle: { color: '#B57BFF', fontSize: 12, fontWeight: '700' },
  promptBody: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', lineHeight: 22 },
  heartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 168, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnPressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },

  // ── Square photos ──
  squarePhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    marginTop: 12,
    backgroundColor: 'rgba(30, 15, 60, 0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  squarePhotoInitials: { color: 'rgba(255,255,255,0.2)', fontSize: 48, fontWeight: '700', letterSpacing: 2 },
});
