/**
 * DiscoverCard
 *
 * Real discover profile card fed by get_discover_deck: hero avatar with a
 * tiered score ring + name overlay, free (Western) vs paid (Vedic)
 * compatibility stats. Photo/prompt/attribute sections from the original
 * design mock are omitted for now -- get_discover_deck doesn't surface
 * photos, prompts, or interest/lifestyle attributes yet (those live in
 * user_photos / section1_qns and aren't joined into the deck query), and
 * showing fabricated placeholder content under a real person's name would be
 * exactly the "misdirection" this feature was built to avoid.
 *
 * Floating panels use expo-glass-effect's GlassView for real iOS 26 Liquid
 * Glass; it renders as a plain View elsewhere, so the rgba/border styling
 * below doubles as the fallback look on Android and older iOS.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { GlassView } from 'expo-glass-effect';

import { getScoreTier } from '@/lib/score-tier';
import { CompatibilitySection } from '@/components/compatibility/CompatibilitySection';
import type { DiscoverCardData } from '@/lib/discover';

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

interface DiscoverCardProps {
  card: DiscoverCardData;
}

export function DiscoverCard({ card }: DiscoverCardProps) {
  const name = card.full_name ?? 'Someone new';
  const initials = name.slice(0, 2).toUpperCase();
  const zodiac = card.western_sign ?? null;

  // western_score/indian_score come back as points already scaled into the
  // 45/45/10 total (get_match_score) -- recover the percentage/raw-Guna
  // scale these display components expect. null means "not yet computed for
  // this pair", not "0% compatible", so each shows its own honest caption
  // rather than a real-looking zero.
  const westernPercent = card.western_score != null ? Math.round((card.western_score / 45) * 100) : null;
  const vedicRaw = card.indian_score != null ? Math.round((card.indian_score / 45) * 36) : null;

  return (
    <View style={styles.card}>
      {/* Hero avatar */}
      <View style={styles.hero}>
        <Text style={styles.heroInitials}>{initials}</Text>

        {card.is_top_match_of_day && (
          <View style={styles.topMatchBadge}>
            <Text style={styles.topMatchText}>✦ Top Match of the Day</Text>
          </View>
        )}

        <View style={styles.scoreOverlay}>
          <ScoreRing score={Math.round(card.score)} />
        </View>

        <View style={styles.nameOverlay}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {name}
              {card.age != null ? `, ${card.age}` : ''}
            </Text>
          </View>
          <Text style={styles.subInfo}>
            {[zodiac, card.distance_label].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {/* Compatibility — free (Western) vs paid (Vedic) */}
      <View style={styles.statsSection}>
        <CompatibilitySection
          western={{
            score: westernPercent ?? 0,
            caption: westernPercent != null ? 'Sun compatibility' : 'Not yet scored',
          }}
          vedic={{ score: vedicRaw ?? 0, max: 36, doshaFlagged: false }}
        />
      </View>

      {/* Basics — Hinge-style info card */}
      <GlassView glassEffectStyle="regular" style={styles.basicsCard}>
        <View style={styles.basicsRow}>
          {card.age != null && (
            <View style={styles.basicsChip}>
              <Text style={styles.basicsIcon}>🎂</Text>
              <Text style={styles.basicsText}>{card.age}</Text>
            </View>
          )}
          {card.age != null && card.gender && <View style={styles.basicsDivider} />}
          {card.gender && (
            <View style={styles.basicsChip}>
              <Text style={styles.basicsIcon}>🧑</Text>
              <Text style={styles.basicsText}>{card.gender}</Text>
            </View>
          )}
        </View>
      </GlassView>
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
  subInfo: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', marginTop: 2 },

  topMatchBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(246, 185, 59, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  topMatchText: { color: '#1A1023', fontSize: 11, fontWeight: '800' },

  // ── Compatibility ──
  statsSection: { marginTop: 12 },

  // ── Basics ──
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
});
