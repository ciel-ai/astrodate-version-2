/**
 * DiscoverCard
 *
 * Scrollable profile card for the Discover deck.
 * Layout: Hero photo → photo gallery → prompts → about bio
 *
 * No expo-glass-effect dependency (not installed in this project).
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DiscoverCardData } from '@/lib/discover';

interface DiscoverCardProps {
  card: DiscoverCardData;
  tier: string;
  isDark?: boolean;
  isFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  onOpenMenu?: () => void;
  extraDetails?: {
    education?: string | null;
    drinking?: string | null;
    smoking?: string | null;
    weed?: string | null;
    religion?: string | null;
    sexual_orientation?: string | null;
    have_children?: string | null;
    want_children?: string | null;
    relationship_style?: string | null;
    workout?: string | null;
    diet?: string | null;
    pets?: string | null;
    languages?: string[] | null;
    travel?: string | null;
    relationship_status?: string | null;
    interest?: string[] | null;
    hobbies?: string[] | null;
    introvert_extrovert?: string | null;
  } | null;
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
function SwipeDiscover({ card }: { card: DiscoverCardData }) {
  const [width, setWidth] = useState(0);
  const [pan] = useState(() => new Animated.ValueXY());

  const handleWidth = 54;
  const paddingOffset = 10; // 5px padding on left/right of container
  const maxTranslate = width ? width - handleWidth - paddingOffset : 150;

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, gestureState) => Math.abs(gestureState.dx) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (e, gestureState) => {
        const newX = Math.min(Math.max(0, gestureState.dx), maxTranslate);
        pan.setValue({ x: newX, y: 0 });
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dx >= maxTranslate * 0.55) {
          Animated.timing(pan, {
            toValue: { x: maxTranslate, y: 0 },
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            router.push({
              pathname: '/astro-x-features',
              params: {
                userId: card.user_id,
                fullName: card.full_name ?? '',
                score: card.score?.toString() ?? '',
                personalityScore: card.personality_score?.toString() ?? '',
                westernScore: card.western_score?.toString() ?? '',
                indianScore: card.indian_score?.toString() ?? '',
                whyYouMatch: card.why_you_match ?? '',
                manglikStatus: card.manglik_status !== null ? (card.manglik_status ? 'yes' : 'no') : '',
                nadiDosha: card.nadi_dosha !== null ? (card.nadi_dosha ? 'yes' : 'no') : '',
                bhakootDosha: card.bhakoot_dosha !== null ? (card.bhakoot_dosha ? 'yes' : 'no') : '',
                factors: JSON.stringify(card.personality_factors || null),
              }
            });
            setTimeout(() => {
              Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
              }).start();
            }, 600);
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    }),
    [maxTranslate, pan, card]
  );

  const textOpacity = pan.x.interpolate({
    inputRange: [0, maxTranslate * 0.5, maxTranslate],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <LinearGradient
      colors={['#1E1B4B', '#4C1D95', '#831843']} // deep indigo, royal purple, deep magenta/pink
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.scrollDiscoverBox}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      {/* Background celestial pattern overlay on the right side */}
      <Image
        source={require('@/assets/images/cards/western-card-bg.jpg')}
        style={styles.sliderBgPattern}
        contentFit="cover"
        pointerEvents="none"
      />

      {width > 0 && (
        <Animated.View
          style={[
            styles.swipeProgressFill,
            {
              width: pan.x.interpolate({
                inputRange: [0, maxTranslate],
                outputRange: [54, width - 10],
                extrapolate: 'clamp',
              }),
              pointerEvents: 'none',
            },
          ]}
        />
      )}

      {/* Styled text block matching the reference design */}
      <Animated.View style={[styles.textWrapper, { opacity: textOpacity, pointerEvents: 'none' }]}>
        <View style={styles.swipeTitleRow}>
          <Text style={styles.sparkleIcon}>✨</Text>
          <Text style={styles.scrollDiscoverText}>Swipe to Reveal <Text style={styles.scrollDiscoverTextHighlight}>Compatibility</Text></Text>
        </View>
        <Text style={styles.scrollDiscoverSubtext}>✦ AI • Astrology • Personality Insights ✦</Text>
      </Animated.View>

      {width > 0 && (
        <Animated.View
          style={[
            styles.swipeHandle,
            {
              transform: [{ translateX: pan.x }],
              pointerEvents: 'none',
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

function cap(str: string | undefined | null) {
  if (!str) return '—';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function DiscoverCard({ card, tier, isDark = true, isFlipped = false, onFlipChange, onOpenMenu, extraDetails }: DiscoverCardProps) {
  // Chrome/surface tokens for the info cards (About, Preferences, Lifestyle,
  // prompts, summary) -- NOT applied to anything overlaid directly on a real
  // photo (name/location overlays, verified badge, cosmic-match ring, "Read
  // More" links, back-face scrim), which stay constant across themes.
  const T = {
    surface: isDark ? 'rgba(20, 12, 40, 0.70)' : 'rgba(255,255,255,0.85)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280',
    dim2: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(27,21,40,0.65)',
    placeholderText: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(27,21,40,0.2)',
    placeholderBg: isDark ? 'rgba(30, 15, 60, 0.70)' : 'rgba(0,0,0,0.05)',
  };

  const name = card.full_name ?? 'Someone';
  const age = card.age ?? '';
  const initials = name.slice(0, 2).toUpperCase();
  const locationLabel = card.location ?? '';
  const distanceLabel = card.distance_label ?? '';

  const photos = card.photos ?? [];
  const heroPhoto: string | number | null = photos[0]?.url ?? null;
  const extraPhotos = photos.slice(1);

  const prompts = card.prompts ?? [];

  const [flipAnimation] = useState(() => new Animated.Value(0));

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnimation.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const backOpacity = flipAnimation.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

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

  const [flipDisabled, setFlipDisabled] = useState(false);
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [showAllPrefs, setShowAllPrefs] = useState(false);
  const [showAllLifestyle, setShowAllLifestyle] = useState(false);

  // Animate card flipping based on isFlipped state
  useEffect(() => {
    Animated.timing(flipAnimation, {
      toValue: isFlipped ? 180 : 0,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [isFlipped, flipAnimation]);

  const handleOpenCosmic = () => {
    if (flipDisabled) return;
    setFlipDisabled(true);
    onFlipChange?.(true);
    setTimeout(() => setFlipDisabled(false), 750);
  };

  return (
    <View style={styles.card}>
      <View style={styles.heroContainer}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ rotateY: frontInterpolate }],
              opacity: frontOpacity,
              backfaceVisibility: 'hidden',
              backgroundColor: T.placeholderBg,
              borderRadius: 24,
              overflow: 'hidden',
              pointerEvents: isFlipped ? 'none' : 'auto',
            },
          ]}
        >
          <Pressable onPress={handleOpenCosmic} disabled={flipDisabled} style={StyleSheet.absoluteFill}>
            {heroSource ? (
              <Image source={heroSource} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={[styles.heroInitials, { color: T.placeholderText }]}>{initials}</Text>
            )}
          </Pressable>

          {/* Rendered after (so visually on top of) the full-cover flip
              Pressable above -- captures its own taps without triggering
              handleOpenCosmic underneath. */}
          {onOpenMenu && (
            <Pressable onPress={onOpenMenu} hitSlop={10} style={styles.menuButton}>
              <Text style={styles.menuButtonIcon}>⋯</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Back face — cosmic card reveal */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ rotateY: backInterpolate }],
              opacity: backOpacity,
              backfaceVisibility: 'hidden',
              borderRadius: 24,
              overflow: 'hidden',
              pointerEvents: isFlipped ? 'auto' : 'none',
            },
          ]}
        >
          {/* Background is Pressable to flip back when tapping empty space */}
          <Pressable onPress={() => onFlipChange?.(false)} style={StyleSheet.absoluteFill}>
            <Image
              source={require('@/assets/images/cards/western-card-bg.jpg')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {/* Light scrim so text is readable but bg is visible */}
            <View style={{ ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,5,20,0.65)' }} />
          </Pressable>

          {/* Scrollable cosmic profile content inside the back of the card */}
          <ScrollView
            style={StyleSheet.absoluteFill}
            contentContainerStyle={{ minHeight: '100%' }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <Pressable onPress={() => onFlipChange?.(false)} style={{ padding: 16, paddingBottom: 24, gap: 14 }}>
              {/* Cosmic Profile Overview Grid Card */}
              <LinearGradient
                colors={isDark ? ['rgba(30, 16, 68, 0.85)', 'rgba(15, 8, 38, 0.95)'] : ['#FFFFFF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.aboutGridCard, { borderColor: T.border }]}
              >
                <View style={styles.aboutGridRow}>
                  <View style={styles.gridCol}>
                    <LinearGradient colors={['#EC4899', '#BE185D']} style={styles.gridIconCircleGradient}>
                      <Text style={styles.gridIconText}>💖</Text>
                    </LinearGradient>
                    <Text style={[styles.gridMainText, { color: T.text }]} numberOfLines={1}>Long-term</Text>
                    <Text style={[styles.gridSubText, { color: T.dim }]} numberOfLines={1}>Relationship</Text>
                  </View>
                  <View style={[styles.gridDivider, { backgroundColor: T.border }]} />
                  <View style={styles.gridCol}>
                    <LinearGradient colors={['#A855F7', '#6D28D9']} style={styles.gridIconCircleGradient}>
                      <Text style={styles.gridIconText}>♓</Text>
                    </LinearGradient>
                    <Text style={[styles.gridMainText, { color: T.text }]} numberOfLines={1}>{card.western_sign || 'Pisces'}</Text>
                    <Text style={[styles.gridSubText, { color: T.dim }]} numberOfLines={1}>(Western)</Text>
                  </View>
                  <View style={[styles.gridDivider, { backgroundColor: T.border }]} />
                  <View style={styles.gridCol}>
                    <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.gridIconCircleGradient}>
                      <Text style={styles.gridIconText}>🪐</Text>
                    </LinearGradient>
                    <Text style={[styles.gridMainText, { color: T.text }]} numberOfLines={1}>{card.vedic_sign ? card.vedic_sign.split(' ')[0] : 'Meena'}</Text>
                    <Text style={[styles.gridSubText, { color: T.dim }]} numberOfLines={1}>(Vedic)</Text>
                  </View>
                  <View style={[styles.gridDivider, { backgroundColor: T.border }]} />
                  <View style={styles.gridCol}>
                    <LinearGradient colors={['#F59E0B', '#B45309']} style={styles.gridIconCircleGradient}>
                      <Text style={styles.gridIconText}>⭐</Text>
                    </LinearGradient>
                    <Text style={[styles.gridMainText, { color: T.text }]} numberOfLines={1}>{card.nakshatra || 'Revati'}</Text>
                    <Text style={[styles.gridSubText, { color: T.dim }]} numberOfLines={1}>Nakshatra</Text>
                  </View>
                </View>
                <View style={[styles.capsuleBar, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <View style={styles.capsuleItemColumn}>
                    <View style={styles.capsuleRow}>
                      <Text style={styles.capsuleIcon}>📏</Text>
                      <Text style={[styles.capsuleTextValue, { color: T.text }]}>{card.height_cm || 178} cm</Text>
                    </View>
                    <Text style={[styles.capsuleTextLabel, { color: T.dim }]}>Height</Text>
                  </View>
                  <View style={[styles.capsuleDivider, { backgroundColor: T.border }]} />
                  <View style={styles.capsuleItemColumn}>
                    <View style={styles.capsuleRow}>
                      <Text style={styles.capsuleIcon}>🏫</Text>
                      <Text style={[styles.capsuleTextValue, { color: T.text }]}>{locationLabel.split(',')[0] || 'Chennai'}</Text>
                    </View>
                    <Text style={[styles.capsuleTextLabel, { color: T.dim }]}>Location</Text>
                  </View>
                </View>
              </LinearGradient>

              {!!card.about && (
                <View style={styles.cSection}>
                  <Text style={styles.cSectionTitle}>About Me</Text>
                  <View style={[styles.cCard, { backgroundColor: T.surface, borderColor: T.border }]}>
                    <Text style={[styles.cAboutText, { color: T.dim2 }]} numberOfLines={showFullAbout ? undefined : 4}>
                      {card.about}
                    </Text>
                    {card.about.length > 120 && (
                      <Pressable
                        onPress={() => setShowFullAbout(prev => !prev)}
                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                      >
                        <Text style={{ color: '#C084FC', fontSize: 13, fontWeight: '700' }}>
                          {showFullAbout ? 'Read Less' : 'Read More'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.cSection}>
                <Text style={styles.cSectionTitle}>Preferences & Personality</Text>
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                      <Text style={[styles.cInfoLabel, { color: T.dim }]}>Relationship Status</Text>
                      <Text style={[styles.cInfoValue, { color: T.text }]}>{cap(extraDetails?.relationship_status)}</Text>
                    </View>
                    <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                      <Text style={[styles.cInfoLabel, { color: T.dim }]}>Personality Type</Text>
                      <Text style={[styles.cInfoValue, { color: T.text }]}>{cap(extraDetails?.introvert_extrovert)}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                      <Text style={[styles.cInfoLabel, { color: T.dim }]}>Interested In</Text>
                      <Text style={[styles.cInfoValue, { color: T.text }]}>{cap(extraDetails?.interest?.[0])}</Text>
                    </View>
                    <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                      <Text style={[styles.cInfoLabel, { color: T.dim }]}>Sexual Orientation</Text>
                      <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.sexual_orientation || '—'}</Text>
                    </View>
                  </View>

                  {showAllPrefs && (
                    <>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Religion</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.religion || '—'}</Text>
                        </View>
                        <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Relationship Style</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.relationship_style || '—'}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Have Children</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.have_children || '—'}</Text>
                        </View>
                        <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Want Children</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.want_children || '—'}</Text>
                        </View>
                      </View>
                    </>
                  )}

                  <Pressable
                    onPress={() => setShowAllPrefs(prev => !prev)}
                    style={{ marginTop: 6, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ color: '#C084FC', fontSize: 13, fontWeight: '700' }}>
                      {showAllPrefs ? 'Show Less' : 'Show More'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.cSection}>
                <Text style={styles.cSectionTitle}>Lifestyle</Text>
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                      <Text style={[styles.cInfoLabel, { color: T.dim }]}>Education</Text>
                      <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.education || '—'}</Text>
                    </View>
                    <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                      <Text style={[styles.cInfoLabel, { color: T.dim }]}>Smoking</Text>
                      <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.smoking || '—'}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                      <Text style={[styles.cInfoLabel, { color: T.dim }]}>Drinking</Text>
                      <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.drinking || '—'}</Text>
                    </View>
                    <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                      <Text style={[styles.cInfoLabel, { color: T.dim }]}>Weed</Text>
                      <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.weed || '—'}</Text>
                    </View>
                  </View>

                  {showAllLifestyle && (
                    <>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Workout</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.workout || '—'}</Text>
                        </View>
                        <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Diet</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.diet || '—'}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Pets</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.pets || '—'}</Text>
                        </View>
                        <View style={[styles.cGrid2ColFlex, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Travel</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails?.travel || '—'}</Text>
                        </View>
                      </View>
                      {extraDetails?.languages && extraDetails.languages.length > 0 && (
                        <View style={[styles.cInfoFullCol, { backgroundColor: T.surface, borderColor: T.border }]}>
                          <Text style={[styles.cInfoLabel, { color: T.dim }]}>Languages Spoken</Text>
                          <Text style={[styles.cInfoValue, { color: T.text }]}>{extraDetails.languages.join(', ')}</Text>
                        </View>
                      )}
                    </>
                  )}

                  <Pressable
                    onPress={() => setShowAllLifestyle(prev => !prev)}
                    style={{ marginTop: 6, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ color: '#C084FC', fontSize: 13, fontWeight: '700' }}>
                      {showAllLifestyle ? 'Show Less' : 'Show More'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {extraDetails?.hobbies && extraDetails.hobbies.length > 0 && (
                <View style={[styles.cSection, { marginBottom: 8 }]}>
                  <Text style={styles.cSectionTitle}>Hobbies & Interests</Text>
                  <View style={styles.cHobbiesWrap}>
                    {extraDetails.hobbies.map((h: string, i: number) => (
                      <View key={i} style={styles.cHobbyChip}>
                        <Text style={styles.cHobbyChipText}>{h}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>



      {/* Name, Age, Location, Looking For & Score Summary Box */}
      <View style={[styles.summaryCard, { backgroundColor: T.surface, borderColor: T.border }]}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryLeft}>
            <View style={styles.summaryNameRow}>
              <Text style={[styles.summaryNameText, { color: T.text }]}>{name}</Text>
              <View style={styles.verifiedBadgeMini}>
                <Text style={styles.verifiedTextMini}>✓</Text>
              </View>
              <Text style={[styles.summaryAgeText, { color: T.text }]}>{age}</Text>
            </View>
            {!!(locationLabel || distanceLabel) && (
              <Text style={[styles.summaryLocationText, { color: T.dim }]}>
                📍 {locationLabel} {distanceLabel ? `• ${distanceLabel.replace('Less than', '<')}` : ''}
              </Text>
            )}
          </View>
          <View style={[styles.summaryScoreRing, { backgroundColor: T.surface }]}>
            <Text style={[styles.summaryScorePercent, { color: T.text }]}>{Math.round(card.score)}%</Text>
            <Text style={[styles.summaryScoreLabel, { color: T.dim }]}>Match</Text>
          </View>
        </View>

        {card.looking_for ? (
          <View style={[styles.summaryLookingFor, !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
            <Text style={[styles.summaryLookingForText, { color: T.text }]}>
              💖 Looking for a <Text style={{ fontWeight: '700', color: '#F59E0B' }}>{card.looking_for.toLowerCase()}</Text>
            </Text>
          </View>
        ) : null}
      </View>

      <SwipeDiscover card={card} />
      <FullPhoto src={ep0src} />
      {prompts[0] && (
        <View style={[styles.promptCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Text style={[styles.promptQuestion, { color: T.dim }]}>{prompts[0].question}</Text>
          <Text style={[styles.promptAnswer, { color: T.text }]}>{prompts[0].answer}</Text>
        </View>
      )}
      <FullPhoto src={ep1src} />
      {prompts[1] && (
        <View style={[styles.promptCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Text style={[styles.promptQuestion, { color: T.dim }]}>{prompts[1].question}</Text>
          <Text style={[styles.promptAnswer, { color: T.text }]}>{prompts[1].answer}</Text>
        </View>
      )}
      <FullPhoto src={ep2src} />
      <FullPhoto src={ep3src} />
      {prompts[2] && (
        <View style={[styles.promptCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Text style={[styles.promptQuestion, { color: T.dim }]}>{prompts[2].question}</Text>
          <Text style={[styles.promptAnswer, { color: T.text }]}>{prompts[2].answer}</Text>
        </View>
      )}
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
    aspectRatio: 3 / 4.4,
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
  heroContainer: {
    width: '100%',
    aspectRatio: 3 / 4.4,
    borderRadius: 24,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#6A3FE0', shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  tapToFlipBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(9, 3, 28, 0.75)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  tapToFlipText: {
    color: '#D4B8FF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  menuButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(9, 3, 28, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  menuButtonIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 18,
  },
  modalScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 5, 20, 0.88)',
  },
  cosmicInline: {
    width: '100%',
    gap: 16,
    paddingTop: 8,
  },
  cosmicCloseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cosmicCloseIcon: {
    color: '#A855F7',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cosmicCloseText: {
    color: '#A855F7',
    fontSize: 14,
    fontWeight: '600',
  },
  cSection: {
    width: '100%',
  },
  cSectionTitle: {
    color: '#BE185D',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  cCard: {
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  cAboutText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  cGrid3: {
    flexDirection: 'row',
    gap: 8,
  },
  cGrid3Col: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cGridEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  cGridLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 8.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cGridValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  cGrid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cGrid2Col: {
    width: '48.5%',
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cGrid2ColFlex: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cInfoFullCol: {
    width: '100%',
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cInfoLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cInfoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  cHobbiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cHobbyChip: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cHobbyChipText: {
    color: '#E9D5FF',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: 'rgba(20, 12, 40, 0.65)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flex: 1,
    gap: 4,
  },
  summaryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryNameText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  verifiedBadgeMini: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  verifiedTextMini: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  summaryAgeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 6,
  },
  summaryLocationText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryScoreRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#EC4899',
    backgroundColor: 'rgba(20, 12, 40, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryScorePercent: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  summaryScoreLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 8,
    fontWeight: '700',
  },
  summaryLookingFor: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  summaryLookingForText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
