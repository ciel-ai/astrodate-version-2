/**
 * DiscoverCard
 *
 * Real discover profile card fed by get_discover_deck: hero photo with a
 * tiered score ring + name overlay, free (Western) vs paid (Vedic)
 * compatibility stats, and (since 20260709120000_discover_deck_photos_prompts)
 * the person's Hinge-style prompts and about section. Interest/lifestyle
 * attribute chips from the original design mock are still omitted -- those
 * live in section1_qns and still aren't joined into the deck query.
 *
 * Falls back to initials when a candidate has no photos yet (never fabricates
 * placeholder photo/prompt content under a real person's name).
 *
 * Floating panels use expo-glass-effect's GlassView for real iOS 26 Liquid
 * Glass; it renders as a plain View elsewhere, so the rgba/border styling
 * below doubles as the fallback look on Android and older iOS.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
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
  /** Caller's own tier (get_discover_deck's top-level `tier`), not the
   *  candidate's -- determines whether the breakdown section below is even
   *  shown. Free only ever gets `score`/`band` (total) from the server now;
   *  western_score/indian_score come back null for a free caller regardless
   *  of whether the pair is actually scored, so this tier check is what
   *  distinguishes "locked behind a paywall" from "genuinely not computed
   *  yet" (which only applies to paid tiers, see the caption fallback below). */
  tier: string;
  /** Opens the report/block menu for this profile -- omitted (no button
   *  rendered) rather than defaulting to a no-op, so a missing wire-up fails
   *  loudly in review instead of silently shipping a dead button. */
  onOpenMenu?: () => void;
}

export function DiscoverCard({ card, tier, onOpenMenu }: DiscoverCardProps) {
  const name = card.full_name ?? 'Someone new';
  const initials = name.slice(0, 2).toUpperCase();
  const zodiac = card.western_sign ?? null;
  const heroPhoto = card.photos?.[0]?.url ?? null;
  const isFreeTier = tier === 'free';

  // western_score/indian_score come back as points already scaled into the
  // 45/45/10 total (get_match_score) -- recover the percentage/raw-Guna
  // scale these display components expect. null means "not yet computed for
  // this pair" for a paid caller, or "gated -- upgrade to see" for a free
  // one (isFreeTier below picks between those two captions).
  const westernPercent = card.western_score != null ? Math.round((card.western_score / 45) * 100) : null;
  const vedicRaw = card.indian_score != null ? Math.round((card.indian_score / 45) * 36) : null;
  const hasDosha = Boolean(card.manglik_status || card.nadi_dosha || card.bhakoot_dosha);

  return (
    <View style={styles.card}>
      {/* Hero photo */}
      <View style={styles.hero}>
        {heroPhoto ? (
          <Image source={{ uri: heroPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.heroInitials}>{initials}</Text>
        )}

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

        {onOpenMenu && (
          <Pressable
            onPress={onOpenMenu}
            style={[styles.menuButton, card.is_top_match_of_day && styles.menuButtonBelowBadge]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Report or block ${name}`}
          >
            <Text style={styles.menuButtonText}>⋯</Text>
          </Pressable>
        )}
      </View>

      {/* Compatibility breakdown -- Section 3: Free sees total score only
          (already shown in the ScoreRing above), Astro+/AstroX get the full
          Western/Vedic split. */}
      {isFreeTier ? (
        <View style={styles.breakdownLockedRow}>
          <Text style={styles.breakdownLockedText}>
            🔒 Upgrade to see the full compatibility breakdown
          </Text>
        </View>
      ) : (
        <View style={styles.statsSection}>
          <CompatibilitySection
            western={{
              score: westernPercent ?? 0,
              caption: westernPercent != null ? 'Sun compatibility' : 'Not yet scored',
            }}
            vedic={{ score: vedicRaw ?? 0, max: 36, doshaFlagged: hasDosha, pending: vedicRaw == null }}
          />
        </View>
      )}

      {/* "Why you match" — AstroX-only synastry narrative (Section 3) */}
      {card.why_you_match && (
        <GlassView glassEffectStyle="regular" style={styles.whyMatchCard}>
          <Text style={styles.sectionLabel}>✦ WHY YOU MATCH</Text>
          <Text style={styles.aboutText}>{card.why_you_match}</Text>
        </GlassView>
      )}

      {/* Basics — Hinge-style info card. Hidden entirely when there's
          nothing to show (same rule the About/prompt sections already
          follow) rather than rendering an empty glass box with no chips
          inside it. */}
      {(card.age != null || card.gender) && (
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
      )}

      {/* About */}
      {card.about && (
        <GlassView glassEffectStyle="regular" style={styles.aboutCard}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <Text style={styles.aboutText}>{card.about}</Text>
        </GlassView>
      )}

      {/* Photos beyond the hero, interspersed with prompts -- Hinge-style
          pacing (prompt, photo, prompt, photo...) rather than dumping every
          prompt up front and every remaining photo in a grid at the very
          bottom, where it's easy to scroll past and only ever really shows
          the hero. Whichever list is longer (prompts can be up to 3;
          photos up to 6, 3 mandatory) just continues on its own past where
          the other runs out. */}
      {interleavePromptsAndPhotos(card.prompts, card.photos.slice(1)).map((item) =>
        item.kind === 'prompt' ? (
          <GlassView key={`prompt-${item.index}`} glassEffectStyle="regular" style={styles.promptCard}>
            <Text style={styles.promptQuestion}>{item.prompt.question}</Text>
            <Text style={styles.promptAnswer}>{item.prompt.answer}</Text>
          </GlassView>
        ) : (
          <View key={`photo-${item.index}`} style={styles.galleryPhotoWrap}>
            <Image source={{ uri: item.photo.url }} style={styles.galleryPhoto} contentFit="cover" />
          </View>
        )
      )}
    </View>
  );
}

type FeedItem =
  | { kind: 'prompt'; index: number; prompt: DiscoverCardData['prompts'][number] }
  | { kind: 'photo'; index: number; photo: DiscoverCardData['photos'][number] };

/** prompt, photo, prompt, photo... continuing with whichever list runs longer. */
function interleavePromptsAndPhotos(
  prompts: DiscoverCardData['prompts'],
  photos: DiscoverCardData['photos']
): FeedItem[] {
  const items: FeedItem[] = [];
  const maxLen = Math.max(prompts.length, photos.length);
  for (let i = 0; i < maxLen; i++) {
    if (prompts[i]) items.push({ kind: 'prompt', index: i, prompt: prompts[i] });
    if (photos[i]) items.push({ kind: 'photo', index: i, photo: photos[i] });
  }
  return items;
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

  menuButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(9, 3, 28, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonBelowBadge: { top: 54 },
  menuButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', lineHeight: 18 },

  // ── Compatibility ──
  statsSection: { marginTop: 12 },
  breakdownLockedRow: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(246, 185, 59, 0.3)',
    backgroundColor: 'rgba(246, 185, 59, 0.06)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  breakdownLockedText: { color: 'rgba(246, 185, 59, 0.95)', fontSize: 13, fontWeight: '600' },

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

  // ── About / Prompts ──
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  aboutCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  aboutText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  whyMatchCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(246, 185, 59, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(246, 185, 59, 0.3)',
    padding: 16,
  },

  promptCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  promptQuestion: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  promptAnswer: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 23 },

  // ── Gallery photos (interspersed with prompts) ──
  galleryPhotoWrap: {
    marginTop: 12,
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 15, 60, 0.70)',
  },
  galleryPhoto: {
    width: '100%',
    height: '100%',
  },
});
