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
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import type { DiscoverCardData } from '@/lib/discover';

function openPaywall(reason: string) {
  router.push({ pathname: '/paywall', params: { reason } } as any);
}

function GatedSection({
  title,
  info,
  caret,
  locked,
  onLockPress,
  children,
}: {
  title: string;
  info?: boolean;
  caret?: boolean;
  locked: boolean;
  onLockPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <GlassView glassEffectStyle="regular" style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <View style={styles.sectionHeaderRight}>
          {info && (
            <View style={styles.infoIconCircle}>
              <Text style={styles.infoIconText}>i</Text>
            </View>
          )}
          {caret && <Text style={styles.caretText}>❯</Text>}
        </View>
      </View>

      {locked ? (
        <Pressable onPress={onLockPress} style={styles.lockContainer}>
          <Text style={styles.lockIconLarge}>🔒</Text>
          <Text style={styles.lockLabel}>Upgrade to unlock this cosmic insight</Text>
        </Pressable>
      ) : (
        <View style={styles.sectionContent}>{children}</View>
      )}
    </GlassView>
  );
}

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

  const isFreeTier = tier === 'free';
  const isAstroPlus = tier === 'astro_plus' || tier === 'astroplus';

  const onUpgradePress = () => openPaywall('discover_card_gated_section');

  // Static interest chips from mockup
  const candidateHobbies = [
    { id: 'movies', name: 'Movies', icon: '🎬' },
    { id: 'travel', name: 'Travel', icon: '✈️' },
    { id: 'coffee', name: 'Coffee', icon: '☕' },
    { id: 'stocks', name: 'Stocks', icon: '📈' },
    { id: 'gaming', name: 'Gaming', icon: '🎮' },
    { id: 'music', name: 'Music', icon: '🎵' },
    { id: 'more', name: 'More', icon: '•••' },
  ];

  // Detailed mockup bullets for Why You Matched
  const whyMatchedBullets = [
    'You both love travelling',
    'Both enjoy movies and coffee',
    'Looking for a long-term relationship',
    'Similar communication style',
    'High emotional compatibility',
  ];

  // Intersecting interests list
  const sharedInterests = ['Movies', 'Travel', 'Coffee', 'Investing', 'Dogs'];

  return (
    <View style={styles.card}>
      {/* ── Hero Image Section ── */}
      <View style={styles.hero}>
        {sourceImage ? (
          <Image source={sourceImage} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.heroInitials}>{initials}</Text>
        )}

        {/* Top-left: Horizontal progress bar indicators */}
        <View style={styles.paginationRow}>
          <View style={[styles.paginationLine, styles.paginationLineActive]} />
          <View style={styles.paginationLine} />
          <View style={styles.paginationLine} />
          <View style={styles.paginationLine} />
        </View>

        {/* Top-right: Outline bookmark/save icon */}
        <View style={styles.bookmarkButton}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 3h14a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

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

        {/* Interest chips list at the bottom overlay */}
        <View style={styles.interestsOverlay}>
          {candidateHobbies.map((hobby) => (
            <View key={hobby.id} style={styles.hobbyChipWrapper}>
              <GlassView glassEffectStyle="clear" style={styles.hobbyIconCircle}>
                <Text style={styles.hobbyIconText}>{hobby.icon}</Text>
              </GlassView>
              <Text style={styles.hobbyLabel}>{hobby.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 1. Why you matched Card (AstroX gated) ── */}
      <GatedSection
        title="✨ Why you matched"
        locked={isFreeTier || isAstroPlus}
        onLockPress={onUpgradePress}
      >
        <View style={styles.bulletsList}>
          {whyMatchedBullets.map((bullet, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkText}>✓</Text>
              </View>
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
      </GatedSection>

      {/* ── 2. Cosmic Compatibility Card (Astro+ gated) ── */}
      <GatedSection
        title="⚡ Cosmic Compatibility"
        info
        locked={isFreeTier}
        onLockPress={onUpgradePress}
      >
        <View style={styles.cosmicCompContent}>
          <Svg width={110} height={110} viewBox="0 0 100 100" style={styles.astrolabeSvg}>
            <Circle
              cx="50"
              cy="50"
              r="45"
              stroke="rgba(179, 133, 255, 0.15)"
              strokeWidth={1}
              strokeDasharray="3, 3"
              fill="none"
            />
            <Circle
              cx="50"
              cy="50"
              r="35"
              stroke="rgba(179, 133, 255, 0.25)"
              strokeWidth={1}
              fill="none"
            />
            <Circle
              cx="50"
              cy="50"
              r="25"
              stroke="rgba(179, 133, 255, 0.4)"
              strokeWidth={1.2}
              strokeDasharray="5, 3"
              fill="none"
            />
            <Circle
              cx="50"
              cy="50"
              r="15"
              stroke="rgba(179, 133, 255, 0.6)"
              strokeWidth={1.5}
              fill="none"
            />
            {/* Center star */}
            <Path d="M50 40 L52 47 L59 50 L52 53 L50 60 L48 53 L41 50 L48 47 Z" fill="#B385FF" />
            {/* Small decorative stars */}
            <Circle cx="30" cy="30" r="0.8" fill="#B385FF" />
            <Circle cx="70" cy="70" r="0.8" fill="#B385FF" />
            <Circle cx="35" cy="65" r="0.8" fill="#B385FF" />
            <Circle cx="65" cy="35" r="1.2" fill="#B385FF" />
          </Svg>
          <Text style={styles.cosmicCompCaption}>
            Exceptional match across Western, Vedic & Personality astrology.
          </Text>
        </View>
      </GatedSection>

      {/* ── 3. Shared Interests Card (Astro+ gated) ── */}
      <GatedSection
        title="💜 Shared Interests"
        locked={isFreeTier}
        onLockPress={onUpgradePress}
      >
        <View style={styles.sharedInterestsContent}>
          <LinearGradient colors={['#EC4899', '#8B5CF6']} style={styles.gradientHeart}>
            <Text style={styles.heartEmoji}>♥</Text>
          </LinearGradient>
          <View style={styles.sharedInterestsTextWrap}>
            <Text style={styles.sharedInterestsCount}>{sharedInterests.length} Things you both like</Text>
            <Text style={styles.sharedInterestsList}>{sharedInterests.join(', ')}</Text>
          </View>
        </View>
      </GatedSection>

      {/* ── 4. Synastry Badges Card (AstroX gated) ── */}
      <GatedSection
        title="✨ Synastry Badges"
        locked={isFreeTier || isAstroPlus}
        onLockPress={onUpgradePress}
      >
        <View style={styles.synastryContent}>
          <View style={styles.badgeIconWrap}>
            <Svg width={44} height={44} viewBox="0 0 40 40">
              <Circle
                cx="20"
                cy="20"
                r="18"
                fill="rgba(179, 133, 255, 0.08)"
                stroke="rgba(179, 133, 255, 0.25)"
                strokeWidth={1}
              />
              <Path d="M20 12 L22 18 L28 20 L22 22 L20 28 L18 22 L12 20 L18 18 Z" fill="#B385FF" />
            </Svg>
          </View>
          <View style={styles.synastryTextWrap}>
            <Text style={styles.synastryCount}>3 Special cosmic connections</Text>
            <Text style={styles.synastryList}>Harmonious Souls, Nadi Match, Gana Match</Text>
          </View>
        </View>
      </GatedSection>

      {/* ── 5. Indian Astrology Card (Astro+ gated) ── */}
      <GatedSection
        title="🛡️ Indian Astrology"
        info
        locked={isFreeTier}
        onLockPress={onUpgradePress}
      >
        <View style={styles.indianAstrologyContent}>
          <View style={styles.omCircle}>
            <Text style={styles.omSymbol}>🕉</Text>
          </View>
          <View style={styles.indianAstrologyList}>
            <View style={styles.doshaRow}>
              <Text style={styles.manglikLabel}>⚠️ Manglik (Mild)</Text>
            </View>
            <View style={styles.doshaRow}>
              <Text style={styles.doshaText}>Nadi Dosha</Text>
              <Text style={styles.doshaValue}>No Dosha</Text>
              <View style={styles.greenCheckCircle}>
                <Text style={styles.greenCheckText}>✓</Text>
              </View>
            </View>
            <View style={styles.doshaRow}>
              <Text style={styles.doshaText}>Bhakoot Dosha</Text>
              <Text style={styles.doshaValue}>Good</Text>
              <View style={styles.greenCheckCircle}>
                <Text style={styles.greenCheckText}>✓</Text>
              </View>
            </View>
          </View>
        </View>
      </GatedSection>

      {/* ── 6. Ashtakoota Card (Astro+ gated) ── */}
      <GatedSection
        title="⚡ Ashtakoota (36/36)"
        info
        locked={isFreeTier}
        onLockPress={onUpgradePress}
      >
        <View style={styles.ashtakootaContent}>
          <View style={styles.lotusCircle}>
            <Text style={styles.lotusValue}>9</Text>
          </View>
          <View style={styles.ashtakootaRight}>
            <Text style={styles.ashtakootaScore}>{card.indian_score ?? 28} / 36</Text>
            <Text style={styles.ashtakootaLabel}>Excellent Match</Text>
            <Text style={styles.ashtakootaLink}>View full Ashtakoota breakdown ❯</Text>
          </View>
        </View>
      </GatedSection>

      {/* ── 7. Personality Score Card (Astro+ gated) ── */}
      <GatedSection
        title="🧠 Personality Score (10%)"
        caret
        locked={isFreeTier}
        onLockPress={onUpgradePress}
      >
        <View style={styles.personalityContent}>
          <View style={styles.personalityAvatarCircle}>
            <View style={styles.personalityAvatarInner} />
          </View>
          <View style={styles.personalityTextWrap}>
            <Text style={styles.personalityScoreText}>{card.personality_score ?? 74}%</Text>
            <Text style={styles.personalityDesc}>Good compatibility based on your personality.</Text>
          </View>
        </View>
      </GatedSection>

      {/* ── 8. More About Card (Ungated) ── */}
      <GlassView glassEffectStyle="regular" style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👤 More About {name}</Text>
          <Text style={styles.caretText}>❯</Text>
        </View>
        <View style={styles.attributesList}>
          <View style={styles.attributeRow}>
            <Text style={styles.attributeIcon}>📏</Text>
            <Text style={styles.attributeText}>{"Height: 5'10\""}</Text>
          </View>
          <View style={styles.attributeRow}>
            <Text style={styles.attributeIcon}>🌐</Text>
            <Text style={styles.attributeText}>Language: Tamil, English</Text>
          </View>
          <View style={styles.attributeRow}>
            <Text style={styles.attributeIcon}>🎓</Text>
            <Text style={styles.attributeText}>Education: Student</Text>
          </View>
          <View style={styles.attributeRow}>
            <Text style={styles.attributeIcon}>❤️</Text>
            <Text style={styles.attributeText}>Lifestyle: Non-smoker</Text>
          </View>
        </View>
      </GlassView>
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
  paginationRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    gap: 4,
  },
  paginationLine: {
    width: 24,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
  },
  paginationLineActive: {
    backgroundColor: '#B385FF',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 8,
  },
  scoreOverlay: {
    position: 'absolute',
    top: '30%',
    right: 14,
  },
  cosmicMatchRing: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    width: 90,
    height: 90,
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
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  cosmicMatchLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 7,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 3,
  },
  starIcon: {
    fontSize: 7,
    color: '#F59E0B',
  },
  nameOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 74,
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
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
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
    marginTop: 4,
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
