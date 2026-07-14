/**
 * DiscoverCard
 *
 * Scrollable profile card for the Discover deck.
 * Layout: Hero photo → photo gallery → prompts → about bio
 *
 * No expo-glass-effect dependency (not installed in this project).
 */
import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, Animated, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import type { DiscoverCardData } from '@/lib/discover';

interface DiscoverCardProps {
  card: DiscoverCardData;
  tier: string;
}

/** Simple full-width photo block used throughout the profile card. */
function FullPhoto({ src }: { src: number | { uri: string } | null }) {
  if (!src) return null;
  return (
    <View style={photoStyles.wrap}>
      <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}


const photoStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,15,60,0.7)',
  },
});

/** Interactive "Swipe to Discover" slider that triggers paywall screen navigation on complete swipe. */
function SwipeDiscover() {
  const [width, setWidth] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;

  const handleWidth = 54;
  const paddingOffset = 10; // 5px padding on left/right of container
  const maxTranslate = width ? width - handleWidth - paddingOffset : 150;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        const newX = Math.min(Math.max(0, gestureState.dx), maxTranslate);
        pan.setValue({ x: newX, y: 0 });
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dx >= maxTranslate * 0.75) {
          Animated.timing(pan, {
            toValue: { x: maxTranslate, y: 0 },
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            router.push('/astro-x-features');
            setTimeout(() => {
              Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
              }).start();
            }, 600);
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const textOpacity = pan.x.interpolate({
    inputRange: [0, maxTranslate * 0.5, maxTranslate],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const progressTranslateX = pan.x.interpolate({
    inputRange: [0, maxTranslate || 1],
    outputRange: [-(width || 300), -handleWidth - 5],
    extrapolate: 'clamp',
  });

  return (
    <LinearGradient
      colors={['#1E1B4B', '#4C1D95', '#831843']} // deep indigo, royal purple, deep magenta/pink
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.scrollDiscoverBox}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {/* Background celestial pattern overlay on the right side */}
      <Image
        source={require('@/assets/images/cards/western-card-bg.jpg')}
        style={styles.sliderBgPattern}
        contentFit="cover"
      />


      {/* Styled text block matching the reference design */}
      <Animated.View style={[styles.textWrapper, { opacity: textOpacity }]}>
        <View style={styles.swipeTitleRow}>
          <Text style={styles.sparkleIcon}>✨</Text>
          <Text style={styles.scrollDiscoverText}>Swipe to Reveal <Text style={styles.scrollDiscoverTextHighlight}>Compatibility</Text></Text>
        </View>
        <Text style={styles.scrollDiscoverSubtext}>✦ AI • Astrology • Personality Insights ✦</Text>
      </Animated.View>
      
      {width > 0 && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.swipeHandle,
            {
              transform: [{ translateX: pan.x }],
            },
          ]}
        >
          <View style={styles.swipeHandleInnerCircle}>
            <Text style={styles.swipeArrow}>➔</Text>
          </View>
        </Animated.View>
      )}
    </LinearGradient>
  );
}


export function DiscoverCard({ card, tier }: DiscoverCardProps) {
  const name = card.full_name ?? 'Someone';
  const age = card.age ?? '';
  const initials = name.slice(0, 2).toUpperCase();
  const zodiac = card.western_sign ?? '';
  const locationLabel = card.location ?? '';
  const distanceLabel = card.distance_label ?? '';

  const photos = card.photos ?? [];
  const heroPhoto: string | number | null = photos[0]?.url ?? null;
  const extraPhotos = photos.slice(1);

  const prompts = card.prompts ?? [];
  const about = card.about ?? null;

  function resolveSource(url: string | number | null | undefined): number | { uri: string } | null {
    if (url === null || url === undefined) return null;
    if (typeof url === 'number') return url;
    if (typeof url === 'string' && url.length > 0) return { uri: url };
    return null;
  }

  // Pre-resolve all extra photo sources so we avoid IIFEs in JSX
  const ep0src = resolveSource(extraPhotos[0]?.url);
  const ep1src = resolveSource(extraPhotos[1]?.url);
  const ep2src = resolveSource(extraPhotos[2]?.url);
  const ep3src = resolveSource(extraPhotos[3]?.url);
  const ep4src = resolveSource(extraPhotos[4]?.url);

  const heroSource = resolveSource(heroPhoto);

  return (
    <View style={styles.card}>

      {/* ── 1. Hero Photo ── */}
      <View style={styles.hero}>
        {heroSource ? (
          <Image source={heroSource} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.heroInitials}>{initials}</Text>
        )}

        {/* Cosmic Match ring – bottom right */}
        <View style={styles.scoreOverlay}>
          <View style={styles.cosmicMatchRing}>
            <Text style={styles.cosmicMatchPercent}>{Math.round(card.score)}%</Text>
            <Text style={styles.cosmicMatchLabel}>Compatibility</Text>
            <Text style={styles.cosmicMatchPlus}>+++</Text>
          </View>
        </View>

        {/* Name / location overlay – bottom left */}
        <View style={styles.nameOverlay}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>{name}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓</Text>
            </View>
            <Text style={styles.nameAgeText}>{age}</Text>
          </View>

          {(locationLabel || distanceLabel) ? (
            <View style={styles.locationRowHero}>
              <Text style={styles.locationPinHero}>📍</Text>
              <Text style={styles.locationTextHero}>
                {locationLabel}  •  {distanceLabel.replace('Less than', '<')}
              </Text>
            </View>
          ) : null}

          {card.looking_for ? (
            <View style={styles.lookingForBadgeHero}>
              <Text style={styles.lookingForHeartHero}>💖</Text>
              <Text style={styles.lookingForTextHero}>Looking for a {card.looking_for.toLowerCase()}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── 2. About (structured grid info card) ── */}
      <LinearGradient
        colors={['rgba(30, 16, 68, 0.85)', 'rgba(15, 8, 38, 0.95)']} // deep indigo-violet space gradient
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.aboutGridCard}
      >
        {/* Top grid: 4 columns */}
        <View style={styles.aboutGridRow}>
          {/* Col 1: Relationship */}
          <View style={styles.gridCol}>
            <LinearGradient
              colors={['#EC4899', '#BE185D']} // pink gradient
              style={styles.gridIconCircleGradient}
            >
              <Text style={styles.gridIconText}>💖</Text>
            </LinearGradient>
            <Text style={styles.gridMainText} numberOfLines={1}>Long-term</Text>
            <Text style={styles.gridSubText} numberOfLines={1}>Relationship</Text>
          </View>

          <View style={styles.gridDivider} />

          {/* Col 2: Western Zodiac */}
          <View style={styles.gridCol}>
            <LinearGradient
              colors={['#A855F7', '#6D28D9']} // purple gradient
              style={styles.gridIconCircleGradient}
            >
              <Text style={styles.gridIconText}>♓</Text>
            </LinearGradient>
            <Text style={styles.gridMainText} numberOfLines={1}>{card.western_sign || 'Pisces'}</Text>
            <Text style={styles.gridSubText} numberOfLines={1}>(Western)</Text>
          </View>

          <View style={styles.gridDivider} />

          {/* Col 3: Vedic Zodiac */}
          <View style={styles.gridCol}>
            <LinearGradient
              colors={['#3B82F6', '#1D4ED8']} // blue gradient
              style={styles.gridIconCircleGradient}
            >
              <Text style={styles.gridIconText}>🪐</Text>
            </LinearGradient>
            <Text style={styles.gridMainText} numberOfLines={1}>{card.vedic_sign ? card.vedic_sign.split(' ')[0] : 'Meena'}</Text>
            <Text style={styles.gridSubText} numberOfLines={1}>(Vedic)</Text>
          </View>

          <View style={styles.gridDivider} />

          {/* Col 4: Nakshatra */}
          <View style={styles.gridCol}>
            <LinearGradient
              colors={['#F59E0B', '#B45309']} // gold/star gradient
              style={styles.gridIconCircleGradient}
            >
              <Text style={styles.gridIconText}>⭐</Text>
            </LinearGradient>
            <Text style={styles.gridMainText} numberOfLines={1}>{card.nakshatra || 'Revati'}</Text>
            <Text style={styles.gridSubText} numberOfLines={1}>Nakshatra</Text>
          </View>
        </View>

        {/* Bottom capsule bar: Height & Location */}
        <View style={styles.capsuleBar}>
          <View style={styles.capsuleItemColumn}>
            <View style={styles.capsuleRow}>
              <Text style={styles.capsuleIcon}>📏</Text>
              <Text style={styles.capsuleTextValue}>{card.height_cm || 178} cm</Text>
            </View>
            <Text style={styles.capsuleTextLabel}>Height</Text>
          </View>

          <View style={styles.capsuleDivider} />

          <View style={styles.capsuleItemColumn}>
            <View style={styles.capsuleRow}>
              <Text style={styles.capsuleIcon}>🏫</Text>
              <Text style={styles.capsuleTextValue}>{locationLabel.split(',')[0] || 'Chennai'}</Text>
            </View>
            <Text style={styles.capsuleTextLabel}>Location</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Swipe to Discover slider */}
      <SwipeDiscover />


      {/* ── 3. Photo 2 ── */}
      <FullPhoto src={ep0src} />

      {/* ── 4. Prompt 1 ── */}
      {prompts[0] && (
        <View style={styles.promptCard}>
          <Text style={styles.promptQuestion}>{prompts[0].question}</Text>
          <Text style={styles.promptAnswer}>{prompts[0].answer}</Text>
        </View>
      )}

      {/* ── 5. Photo 3 ── */}
      <FullPhoto src={ep1src} />

      {/* ── 6. Prompt 2 ── */}
      {prompts[1] && (
        <View style={styles.promptCard}>
          <Text style={styles.promptQuestion}>{prompts[1].question}</Text>
          <Text style={styles.promptAnswer}>{prompts[1].answer}</Text>
        </View>
      )}

      {/* ── 7. Photo 4 ── */}
      <FullPhoto src={ep2src} />

      {/* ── 8. Photo 5 ── */}
      <FullPhoto src={ep3src} />

      {/* ── 9. Prompt 3 ── */}
      {prompts[2] && (
        <View style={styles.promptCard}>
          <Text style={styles.promptQuestion}>{prompts[2].question}</Text>
          <Text style={styles.promptAnswer}>{prompts[2].answer}</Text>
        </View>
      )}

      {/* ── 10. Photo 6 ── */}
      <FullPhoto src={ep4src} />

      <View style={{ height: 8 }} />

    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', gap: 12 },

  // ── Hero ──
  hero: {
    width: '100%',
    aspectRatio: 3 / 4,
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
    bottom: 16,
    right: 16,
  },
  cosmicMatchRing: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 38,
    width: 76,
    height: 76,
    backgroundColor: 'rgba(20, 12, 40, 0.75)',
    borderWidth: 2,
    borderColor: '#EC4899', // bright neon pink border matching the screenshot
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#EC4899', shadowOpacity: 0.5, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  cosmicMatchPercent: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  cosmicMatchLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 7.5,
    fontWeight: '700',
    marginTop: 0.5,
    textAlign: 'center',
  },
  cosmicMatchPlus: {
    color: '#F59E0B', // gold crosses
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },

  // Name overlay
  nameOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    right: 100, // leave space for the ring
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  nameAgeText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginLeft: 8,
  },
  locationRowHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationPinHero: {
    fontSize: 12,
  },
  locationTextHero: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
  },
  lookingForBadgeHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 12, 40, 0.65)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  lookingForHeartHero: {
    fontSize: 11,
  },
  lookingForTextHero: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Gallery ──
  galleryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  galleryItem: {
    flex: 1,
    height: 200,
    borderRadius: 16,
    backgroundColor: 'rgba(30,15,60,0.7)',
    overflow: 'hidden',
  },
  galleryPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPlaceholderText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 32,
    fontWeight: '700',
  },

  // ── Full-width single photo ──
  fullWidthPhoto: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,15,60,0.7)',
  },

  // ── Prompts ──
  promptCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(20,12,40,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(179,133,255,0.18)',
    padding: 16,
    gap: 8,
  },
  promptQuestion: {
    color: '#B385FF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptAnswer: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },

  // ── About Grid Card ──
  aboutGridCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(20,12,40,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 18,
    paddingHorizontal: 10,
    width: '100%',
  },
  aboutGridRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  gridCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridIconCircleGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  gridIconText: {
    fontSize: 18,
  },
  gridMainText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  gridSubText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 8.5,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  gridDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  capsuleBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 5, 22, 0.55)',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  capsuleItemColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  capsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  capsuleDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  capsuleIcon: {
    fontSize: 14,
  },
  capsuleTextValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  capsuleTextLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Scroll Down Indicator Box
  // Scroll Down Indicator Box
  scrollDiscoverBox: {
    width: '100%',
    height: 66,
    borderRadius: 33,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  swipeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sparkleIcon: {
    fontSize: 14,
    color: '#FDE047',
  },
  scrollDiscoverText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  scrollDiscoverTextHighlight: {
    color: '#EC4899', // bright neon pink matching highlight
  },
  scrollDiscoverSubtext: {
    color: '#93C5FD',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  swipeProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(168, 85, 247, 0.35)',
    borderRadius: 33,
  },
  swipeHandle: {
    position: 'absolute',
    left: 5,
    top: 4.5,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 2,
    borderColor: '#C084FC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  swipeHandleInnerCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  textWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    zIndex: 1,
    paddingLeft: 56, // offset to prevent overlap with start handle
    width: '100%',
  },
  sliderBgPattern: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
    borderRadius: 33,
    zIndex: 0,
  },
});
