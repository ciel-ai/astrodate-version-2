import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Animated,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { useAuth } from '@/context/auth';
import { useAppTheme } from '@/lib/theme-context';
import { getDailyInsight, type DailyInsight } from '@/lib/astro';
import { getLastDrawnAt, isSameLocalDay, recordOracleDraw } from '@/lib/oracle';



import { OracleSealedCard } from '@/components/insights/oracle-sealed-card';
import { CategoryIcon, InsightCategory } from '@/components/insights/category-icons';
import { getInsightsPalette } from '@/components/insights/palette';

type ScreenState = 'loading' | 'sealed' | 'revealed' | 'error';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);



const CATEGORIES: { id: InsightCategory; label: string; icon: InsightCategory; color: string }[] = [
  { id: 'health', label: 'Health', icon: 'health', color: '#10B981' },
  { id: 'emotions', label: 'Emotions', icon: 'emotions', color: '#EC4899' },
  { id: 'profession', label: 'Profession', icon: 'profession', color: '#A78BFA' },
  { id: 'luck', label: 'Luck', icon: 'luck', color: '#F59E0B' },
  { id: 'personal_life', label: 'Personal life', icon: 'personal_life', color: '#3B82F6' },
  { id: 'travel', label: 'Travel', icon: 'travel', color: '#8B5CF6' },
];




const getLuckyColorHex = (colorName?: string): string => {
  if (!colorName) return '#C4A0FF';
  const name = colorName.trim().toLowerCase();
  
  const colorMap: Record<string, string> = {
    'lavender': '#C4A0FF',
    'coral': '#FF7F50',
    'teal': '#0D9488',
    'gold': '#F59E0B',
    'rose pink': '#FDA4AF',
    'sky blue': '#60A5FA',
    'emerald': '#10B981',
    'ivory': '#FFFFF0',
    'amber': '#FBBF24',
    'lilac': '#D8B4FE',
    'turquoise': '#40E0D0',
    'crimson': '#DC143C',
  };

  return colorMap[name] || colorName || '#C4A0FF';
};


function ChevronRightIcon({ rotated, color }: { rotated?: boolean; color: string }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      style={rotated ? { transform: [{ rotate: '90deg' }] } : undefined}
    >
      <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}



function MoonIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#E9D5FF" />
    </Svg>
  );
}

function PlanetIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" fill="#FDBA74" />
      <Path d="M3.5 10.5h17M3.1 13.5h17.8" stroke="#EA580C" strokeWidth="1.2" opacity="0.6" />
    </Svg>
  );
}

function CrystalIcon({ color = '#60A5FA' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L4 9l8 13 8-13-8-7z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity={0.2} />
      <Line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth="1" />
      <Line x1="4" y1="9" x2="20" y2="9" stroke={color} strokeWidth="1" />
    </Svg>
  );
}

function CloverIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12c.5-2.5 2-4 3.5-4s2 1.5 2 3c0 2-3 3-5.5 1zm0 0c.5 2.5 2 4 3.5 4s2-1.5 2-3c0-2-3-3-5.5-1zm0 0c-.5 2.5-2 4-3.5 4s-2-1.5-2-3c0-2 3-3 5.5-1zm0 0c-.5-2.5-2-4-3.5-4s-2 1.5-2 3c0 2 3 3 5.5 1z"
        fill="#4ADE80"
      />
      <Path d="M12 12v6c0 .5-.5 1-1 1" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}


function ClockFace({ isDark }: { isDark: boolean }) {
  const ringStrong = isDark ? 'rgba(196, 160, 255, 0.4)' : 'rgba(124, 58, 237, 0.35)';
  const ringSoft = isDark ? 'rgba(196, 160, 255, 0.15)' : 'rgba(124, 58, 237, 0.12)';
  const numeral = isDark ? 'rgba(196, 160, 255, 0.8)' : 'rgba(124, 58, 237, 0.7)';
  const hourHand = isDark ? '#C4A0FF' : '#7C3AED';
  const minuteHand = isDark ? '#FFFFFF' : '#1B1528';
  const centerDot = isDark ? '#FFFFFF' : '#1B1528';
  const centerDotCore = isDark ? '#0A051B' : '#FFFFFF';
  return (
    <Svg width={90} height={90} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="45" stroke={ringStrong} strokeWidth="1.5" fill="none" />
      <Circle cx="50" cy="50" r="40" stroke={ringSoft} strokeWidth="1" fill="none" />
      <SvgText x="50" y="20" fontSize="8" fill={numeral} textAnchor="middle" fontWeight="bold">XII</SvgText>
      <SvgText x="82" y="53" fontSize="8" fill={numeral} textAnchor="middle" fontWeight="bold">III</SvgText>
      <SvgText x="50" y="87" fontSize="8" fill={numeral} textAnchor="middle" fontWeight="bold">VI</SvgText>
      <SvgText x="18" y="53" fontSize="8" fill={numeral} textAnchor="middle" fontWeight="bold">IX</SvgText>
      <Line x1="50" y1="50" x2="33" y2="35" stroke={hourHand} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="50" y1="50" x2="50" y2="25" stroke={minuteHand} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="50" cy="50" r="3" fill={centerDot} />
      <Circle cx="50" cy="50" r="1.5" fill={centerDotCore} />
    </Svg>
  );
}

export default function InsightsScreen() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';
  const palette = getInsightsPalette(theme);
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<ScreenState>('loading');
  const [drawing, setDrawing] = useState(false);
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [activeCategory, setActiveCategory] = useState<InsightCategory | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');

  const handleCategoryPress = (catId: InsightCategory) => {
    setActiveCategory((prev) => (prev === catId ? null : catId));
  };

  const reveal = useCallback(async (userId: string) => {
    try {
      setErrorDetails('');
      const dailyInsight = await getDailyInsight(userId);
      setInsight(dailyInsight);
      setState(dailyInsight ? 'revealed' : 'error');
    } catch (err: any) {
      console.error('[reveal] error loading daily insight:', err);
      setState('error');
      if (err?.status === 422 || err?.message?.includes('incomplete_birth_data') || String(err).includes('422')) {
        setErrorDetails('Please complete your birth details in your profile first.');
      } else if (err?.status === 502 || err?.message?.includes('astrology_api_error') || String(err).includes('502')) {
        setErrorDetails('Astrology API limit reached or service temporarily unavailable.');
      } else {
        setErrorDetails(err?.message || String(err));
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('error');
      setErrorDetails('No authenticated user found.');
      return;
    }

    (async () => {
      try {
        setState('loading');
        const lastDrawnAt = await getLastDrawnAt(user.id);
        if (isSameLocalDay(lastDrawnAt)) {
          await reveal(user.id);
        } else {
          await recordOracleDraw(user.id);
          await reveal(user.id);
        }
      } catch (err: any) {
        setState('error');
        setErrorDetails(err.message || String(err));
      }
    })();
  }, [user, authLoading, reveal]);

  const handleDraw = async () => {
    if (!user || drawing) return;
    setDrawing(true);
    await recordOracleDraw(user.id);
    await reveal(user.id);
    setDrawing(false);
  };



  // Date styling helper
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    return `Today, ${new Date().toLocaleDateString('en-US', options)}`;
  };

  // Time styling helper
  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      return `${hours}:${minutesStr} ${ampm}`;
    } catch {
      return '';
    }
  };

  const score = insight?.cosmic_weather_score ?? 0;
  const clampedScore = Math.max(0, Math.min(100, score));


  const [animatedProgress] = useState(() => new Animated.Value(0));
  const [animatedScoreDisplay, setAnimatedScoreDisplay] = useState(0);

  // 1. Text Number Count-Up Animation (requestAnimationFrame)
  useEffect(() => {
    if (state !== 'revealed' || !insight) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnimatedScoreDisplay(0);
    const target = clampedScore;
    if (target <= 0) return;

    let startTimestamp: number | null = null;
    const duration = 1500; // 1.5 seconds matching the arc fill
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuad easing function
      const easeOutQuad = (t: number) => t * (2 - t);
      const easedProgress = easeOutQuad(progress);

      setAnimatedScoreDisplay(Math.round(easedProgress * target));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [state, insight, clampedScore]);

  // 2. SVG Arc Timing Animation
  useEffect(() => {
    if (state !== 'revealed' || !insight) return;

    animatedProgress.setValue(0);
    Animated.timing(animatedProgress, {
      toValue: clampedScore,
      duration: 1500, // 1.5 seconds for a slow, premium fill
      useNativeDriver: false,
    }).start();
  }, [state, insight, clampedScore, animatedProgress]);

  const animatedOffset = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: [356.0, 0],
  });

  // Score tier custom mapping
  const getCustomTier = (scoreVal: number) => {
    if (scoreVal < 40) return { label: 'Low energy', color: '#EF4444' };
    if (scoreVal < 70) return { label: 'Moderate energy', color: '#F59E0B' };
    return { label: 'High energy', color: '#A78BFA' };
  };

  const tier = getCustomTier(clampedScore);

  const getCosmicWeatherDescription = (scoreVal: number) => {
    if (scoreVal < 40) return "Today isn't ideal for major decisions.";
    if (scoreVal < 70) return "A balanced day for planning and routine actions.";
    return "Energy is high! A perfect day to take bold actions.";
  };

  // Header + gauge dial content, overlaid on insights-bg.jpg -- same cosmic
  // photo in both themes (user preference), so this text stays light-on-dark
  // regardless of theme rather than switching to palette.textPrimary/Secondary
  // (which would go dark-on-dark against a backdrop that never lightens).
  const topBannerContent = (
    <>
      {/* Header Row (no settings button) */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Daily insights</Text>
          <Text style={styles.headerSubtitle}>{getFormattedDate()}</Text>
        </View>
      </View>

      {/* Semicircle Gauge Dial */}
      <View style={styles.dialContainer}>
        <Svg width={280} height={230} viewBox="0 0 280 230">
          <Defs>
            <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FB7185" />
              <Stop offset="60%" stopColor="#F59E0B" />
              <Stop offset="100%" stopColor="#A78BFA" />
            </LinearGradient>
          </Defs>

          {/* 240-degree Semicircle Track */}
          <Circle
            cx={140}
            cy={115}
            r={85}
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={12}
            strokeDasharray={`${356.0}, ${534.0}`}
            rotation={150}
            origin="140, 115"
            fill="none"
          />

          {/* 240-degree Semicircle Fill */}
          <AnimatedCircle
            cx={140}
            cy={115}
            r={85}
            stroke="url(#gaugeGrad)"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray="356.0, 534.0"
            strokeDashoffset={animatedOffset}
            rotation={150}
            origin="140, 115"
            fill="none"
          />
        </Svg>

        {/* Absolute Dial Text Center */}
        <View style={styles.dialCenter}>
          <Text style={styles.dialCenterLabel}>COSMIC ENERGY</Text>
          <Text style={styles.dialCenterScore}>{animatedScoreDisplay}%</Text>
          <View style={[styles.energyBadge, { borderColor: tier.color }]}>
            <Text style={[styles.energyBadgeText, { color: tier.color }]}>{tier.label}</Text>
          </View>
        </View>
        <Text style={styles.dialCaption}>{getCosmicWeatherDescription(clampedScore)}</Text>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#09031C' : palette.screenBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      )}

      {state === 'sealed' && (
        <ScrollView
          contentContainerStyle={[
            styles.sealedContent,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
        >
          <OracleSealedCard onDraw={handleDraw} drawing={drawing} theme={theme} />
        </ScrollView>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: palette.textPrimary }]}>
            Couldn&apos;t load today&apos;s insight.
          </Text>
          {errorDetails ? (
            <Text style={[styles.errorSubText, { color: palette.textSecondary }]}>
              {errorDetails}
            </Text>
          ) : null}
          <Pressable
            onPress={() => user && reveal(user.id)}
            style={[styles.retryBtn, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.retryText, { color: palette.retryText }]}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {state === 'revealed' && insight && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        >
          {/* Top Semicircle Gauge Card & Best Time Card combined in Galaxy Image BG.
              Light theme has no equivalent photo asset -- tabs-bg-light.jpg is a
              flat, subtle wash meant as a backdrop behind opaque cards elsewhere,
              not a focal banner behind large headline text like this. Swap to a
              soft gradient in the same color story as the gauge itself instead. */}
          <ImageBackground
            source={require('@/assets/images/insights-bg.jpg')}
            style={[styles.topBgContainer, { paddingTop: insets.top + 16 }]}
            imageStyle={styles.topBgImage}
            resizeMode="cover"
          >
            {topBannerContent}
          </ImageBackground>

          {/* Bottom Content Container (transparent overlay on dark background) */}
          <View style={styles.bottomContainer}>
            {/* Best Time Today Card */}
            <View style={[styles.bestTimeCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={styles.bestTimeLeft}>

                <View style={styles.bestTimeTextWrap}>
                  <Text style={[styles.bestTimeLabel, { color: palette.textSecondary }]}>Best time today</Text>
                  <Text style={[styles.bestTimeValue, { color: palette.textPrimary }]}>
                    {insight.best_time
                      ? `${formatTime(insight.best_time.start)} – ${formatTime(insight.best_time.end)} (${insight.best_time.ruling_planet} hour)`
                      : 'No optimal time today'}
                  </Text>
                </View>
              </View>
              <View style={styles.bestTimeRight}>
                <ClockFace isDark={isDark} />
              </View>
            </View>

            {/* 2x2 Grid Section */}
            <View style={styles.gridContainer}>
              <View style={styles.gridRow}>
                <View style={[styles.gridCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                  <View style={[styles.gridIconCircle, { backgroundColor: palette.iconCircleBg, borderColor: palette.iconCircleBorder }]}>
                    <MoonIcon />
                  </View>
                  <View style={styles.gridTextWrap}>
                    <Text style={[styles.gridCardLabel, { color: palette.textSecondary }]}>Moon phase</Text>
                    <Text style={[styles.gridCardValue, { color: palette.textPrimary }]}>{insight.moon_phase}</Text>
                  </View>
                </View>

                <View style={[styles.gridCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                  <View style={[styles.gridIconCircle, { backgroundColor: palette.iconCircleBg, borderColor: palette.iconCircleBorder }]}>
                    <PlanetIcon />
                  </View>
                  <View style={styles.gridTextWrap}>
                    <Text style={[styles.gridCardLabel, { color: palette.textSecondary }]}>Day ruler</Text>
                    <Text style={[styles.gridCardValue, { color: palette.textPrimary }]}>{insight.day_ruler}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={[styles.gridCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                  <View style={[styles.gridIconCircle, { backgroundColor: palette.iconCircleBg, borderColor: palette.iconCircleBorder }]}>
                    <CrystalIcon color={getLuckyColorHex(insight.lucky_color)} />
                  </View>
                  <View style={styles.gridTextWrap}>
                    <Text style={[styles.gridCardLabel, { color: palette.textSecondary }]}>Lucky color</Text>
                    <Text style={[styles.gridCardValue, { color: palette.textPrimary }]}>{insight.lucky_color}</Text>
                  </View>
                </View>

                <View style={[styles.gridCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                  <View style={[styles.gridIconCircle, { backgroundColor: palette.iconCircleBg, borderColor: palette.iconCircleBorder }]}>
                    <CloverIcon />
                  </View>
                  <View style={styles.gridTextWrap}>
                    <Text style={[styles.gridCardLabel, { color: palette.textSecondary }]}>Lucky number</Text>
                    <Text style={[styles.gridCardValue, { color: palette.textPrimary }]}>{insight.lucky_number}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* All Six Categories Today Section */}
            <Text style={[styles.categoriesHeader, { color: palette.textSecondary }]}>ALL SIX CATEGORIES TODAY</Text>
            
            <View style={styles.categoriesList}>
              {insight.prediction &&
                CATEGORIES.map((cat) => {
                  const text = insight.prediction?.[cat.id] ?? '';
                  const isSelected = activeCategory === cat.id;
                  
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => handleCategoryPress(cat.id)}
                      style={[
                        styles.categoryRow,
                        { backgroundColor: palette.cardBgSoft, borderColor: palette.cardBorderSoft },
                        isSelected && [styles.categoryRowSelected, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }],
                      ]}
                    >
                      <View style={[styles.categoryCircle, { backgroundColor: `${cat.color}1E` }]}>
                        <CategoryIcon category={cat.id} color={cat.color} size={18} />
                      </View>
                      <View style={styles.categoryInfo}>
                        <Text style={[styles.categoryName, { color: palette.textPrimary }]}>{cat.label}</Text>
                        <Text
                          style={[
                            styles.categorySnippet,
                            { color: palette.textSecondary },
                            isSelected && { color: palette.textPrimary, marginTop: 4 }
                          ]}
                          numberOfLines={isSelected ? undefined : 2}
                        >
                          {text}
                        </Text>
                      </View>
                      <View style={styles.categoryChevron}>
                        <ChevronRightIcon rotated={isSelected} color={palette.chevron} />
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09031C',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  sealedContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  topBgContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  topBgImage: {
    width: '130%',
    left: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
    fontWeight: '500',
  },
  dialContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  dialCenter: {
    position: 'absolute',
    top: 68,
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
  },
  dialCenterLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
  },
  dialCenterScore: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 44,
    marginTop: 2,
  },
  energyBadge: {
    borderWidth: 1.2,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 10,
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  energyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dialCaption: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -20,
    paddingHorizontal: 20,
    opacity: 0.9,
  },
  bottomContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  gridContainer: {
    gap: 12,
    marginBottom: 20,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  gridIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  gridTextWrap: {
    flex: 1,
  },
  gridCardLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '500',
  },
  gridCardValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
  },
  activeCard: {
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  activeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activeCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeCardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookmarkBtn: {
    padding: 4,
  },
  activeCardBody: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  bestTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
    marginBottom: 16,
  },
  bestTimeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bestTimeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  bestTimeTextWrap: {
    flex: 1,
  },
  bestTimeLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '500',
  },
  bestTimeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  bestTimeRight: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  categoriesList: {
    gap: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 12, 40, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  categoryRowSelected: {
    borderColor: 'rgba(196, 160, 255, 0.4)',
    backgroundColor: 'rgba(20, 12, 40, 0.65)',
  },
  categoryCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    gap: 2,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  categorySnippet: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  categoryChevron: {
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: '#C4A0FF',
    marginTop: 8,
  },
  retryText: {
    color: '#0A051B',
    fontSize: 14,
    fontWeight: '700',
  },
  errorSubText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: -4,
    lineHeight: 18,
  },
});


