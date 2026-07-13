/**
 * DiscoverCard
 *
 * Real discover profile card fed by get_discover_deck: hero photo with a
 * tiered score ring + name overlay, and high-fidelity scrollable sections.
 *
 * Gated according to subscription tiers:
 * - Free: Total score only + "🔒 Upgrade to unlock" banners for details.
 * - Astro+: Access to Cosmic Compatibility, Ashtakoota, and Personality Score.
 * - AstroX: Access to all the above + Synastry Badges and the "Why you matched" narrative.
 *
 * Developer preview profile (Dinesh) is available for dev mode.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { GlassView } from 'expo-glass-effect';

import type { DiscoverCardData } from '@/lib/discover';



interface DiscoverCardProps {
  card: DiscoverCardData;
  tier: string;
}

export function DiscoverCard({ card, tier }: DiscoverCardProps) {
  const name = card.full_name ?? 'Dinesh';
  const age = card.age ?? 19;
  const initials = name.slice(0, 2).toUpperCase();
  const zodiac = card.western_sign ?? 'Pisces';
  const locationLabel = card.location ?? 'Chennai, India';
  const distanceLabel = card.distance_label ?? '3 km away';

  // Support local images (require targets) or remote url strings
  const heroPhoto = card.photos?.[0]?.url ?? null;
  const sourceImage = typeof heroPhoto === 'string' ? { uri: heroPhoto } : heroPhoto;



  return (
    <View style={styles.card}>
      {/* ── Hero Image Section ── */}
      <View style={styles.hero}>
        {sourceImage ? (
          <Image source={sourceImage} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.heroInitials}>{initials}</Text>
        )}



        {/* Cosmic Match radial ring overlay on right side */}
        <View style={styles.scoreOverlay}>
          <GlassView glassEffectStyle="clear" style={styles.cosmicMatchRing}>
            <Text style={styles.cosmicMatchPercent}>{Math.round(card.score)}%</Text>
            <Text style={styles.cosmicMatchLabel}>Cosmic Match</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Text key={i} style={styles.starIcon}>★</Text>
              ))}
            </View>
          </GlassView>
        </View>

        {/* Left Name/Location overlays */}
        <View style={styles.nameOverlay}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {name}, {age}
            </Text>
            {/* Verified badge */}
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓</Text>
            </View>
          </View>

          {/* Zodiac row */}
          <Text style={styles.zodiacText}>
            ♓ {zodiac}
          </Text>

          {/* Location row */}
          <View style={styles.locationRow}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.locationText}>
              {[locationLabel, distanceLabel].filter(Boolean).join('  •  ')}
            </Text>
          </View>

          {/* Looking for pill */}
          <View style={styles.lookingForSection}>
            <Text style={styles.lookingForTitle}>Looking for</Text>
            <View style={styles.lookingForBadge}>
              <Text style={styles.lookingForHeart}>💖</Text>
              <Text style={styles.lookingForText}>Long-term relationship</Text>
            </View>
          </View>
        </View>


      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', gap: 12 },

  // ── Hero ──
  hero: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 15, 60, 0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
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
  cosmicMatchRing: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    width: 66,
    height: 66,
    backgroundColor: 'rgba(20, 12, 40, 0.65)',
    borderWidth: 1.5,
    borderColor: '#B385FF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#B385FF', shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  cosmicMatchPercent: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  cosmicMatchLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 5,
    fontWeight: '700',
    marginTop: 0.5,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 1.5,
  },
  starIcon: {
    fontSize: 5,
    color: '#F59E0B',
  },
  nameOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  zodiacText: {
    color: '#B385FF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationPin: {
    fontSize: 11,
  },
  locationText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  lookingForSection: {
    marginTop: 8,
  },
  lookingForTitle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    fontWeight: '600',
  },
  lookingForBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 99, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  lookingForHeart: {
    fontSize: 10,
  },
  lookingForText: {
    color: '#FF6EA7',
    fontSize: 10,
    fontWeight: '600',
  },
  interestsOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
  },
  hobbyChipWrapper: {
    alignItems: 'center',
    gap: 3,
    width: 44,
  },
  hobbyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(20, 12, 40, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hobbyIconText: {
    fontSize: 13,
  },
  hobbyLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Gated/Section Cards ──
  sectionCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoIconCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  caretText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionContent: {
    marginTop: 2,
  },

  // ── Lock Overlay ──
  lockContainer: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lockIconLarge: {
    fontSize: 20,
  },
  lockLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Section Contents ──
  // Bullets
  bulletsList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  bulletText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },

  // Cosmic Compatibility
  cosmicCompContent: {
    alignItems: 'center',
    gap: 8,
  },
  astrolabeSvg: {
    alignSelf: 'center',
  },
  cosmicCompCaption: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 16,
    paddingHorizontal: 8,
  },

  // Shared Interests
  sharedInterestsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gradientHeart: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartEmoji: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  sharedInterestsTextWrap: {
    flex: 1,
    gap: 2,
  },
  sharedInterestsCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  sharedInterestsList: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Synastry
  synastryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  synastryTextWrap: {
    flex: 1,
    gap: 2,
  },
  synastryCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  synastryList: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Indian Astrology
  indianAstrologyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  omCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(179, 133, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(179, 133, 255, 0.08)',
  },
  omSymbol: {
    color: '#FFFFFF',
    fontSize: 22,
  },
  indianAstrologyList: {
    flex: 1,
    gap: 6,
  },
  doshaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manglikLabel: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  doshaText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    fontWeight: '500',
    width: 84,
  },
  doshaValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  greenCheckCircle: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCheckText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },

  // Ashtakoota
  ashtakootaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  lotusCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(179, 133, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(179, 133, 255, 0.08)',
  },
  lotusValue: {
    color: '#B385FF',
    fontSize: 20,
    fontWeight: '800',
  },
  ashtakootaRight: {
    flex: 1,
    gap: 2,
  },
  ashtakootaScore: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  ashtakootaLabel: {
    color: '#B385FF',
    fontSize: 11,
    fontWeight: '600',
  },
  ashtakootaLink: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
  },

  // Personality Score
  personalityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personalityAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(179, 133, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  personalityAvatarInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(179, 133, 255, 0.5)',
    backgroundColor: 'rgba(179, 133, 255, 0.08)',
  },
  personalityTextWrap: {
    flex: 1,
    gap: 2,
  },
  personalityScoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  personalityDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },

  // More About Attributes
  attributesList: {
    gap: 10,
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attributeIcon: {
    fontSize: 14,
    width: 18,
    textAlign: 'center',
  },
  attributeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
