import { useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';

const SERIF = 'Baskerville-Old-Face';

interface Option {
  id: string;
  label: string;
  dbValue: string;
}

interface Question {
  id: string;
  icon: string;
  label: string;
  dbColumn: string;
  options: Option[];
  isMultiple?: boolean;
}

const QUESTIONS: Question[] = [
  {
    id: 'date_excite',
    icon: '❤️',
    label: 'What type of date excites you the most?',
    dbColumn: 'what_type_of_date_excites_you_the_most',
    isMultiple: true, // column is TEXT[]
    options: [
      { id: 'cafe', label: 'A cozy café where we talk for hours', dbValue: 'cafe' },
      { id: 'explore', label: 'A random new place we decide to explore', dbValue: 'explore' },
      { id: 'dinner', label: 'A movie or simple dinner, nothing too wild', dbValue: 'dinner' },
      { id: 'road_trip', label: 'A totally spontaneous road trip', dbValue: 'road_trip' },
    ],
  },
  {
    id: 'unusual_foods',
    icon: '🍴',
    label: 'How do you feel about trying unusual foods or activities?',
    dbColumn: 'how_do_you_feel_about_trying_unusual_foods_or_activities',
    options: [
      { id: 'stick_known', label: 'Nope, I like sticking to what I know', dbValue: 'stick_known' },
      { id: 'try_encouraged', label: "I'll try if someone encourages me", dbValue: 'try_encouraged' },
      { id: 'open_to_it', label: "Sounds fun, I'm open to it", dbValue: 'open_to_it' },
      { id: 'suggest_crazy', label: "I'm the one who suggests crazy ideas first", dbValue: 'suggest_crazy' },
    ],
  },
  {
    id: 'partner_convos',
    icon: '💬',
    label: 'What kind of conversations do you enjoy with a partner?',
    dbColumn: 'what_kind_of_conversations_do_you_enjoy_with_a_partner',
    options: [
      { id: 'everyday_talks', label: 'Cute, simple, everyday talks', dbValue: 'everyday_talks' },
      { id: 'life_related', label: 'Goal & life-related discussions', dbValue: 'life_related' },
      { id: 'deep_chats', label: 'Deep emotional & philosophical chats', dbValue: 'deep_chats' },
      { id: 'creative_brainstorm', label: 'Random creative brainstorming at midnight', dbValue: 'creative_brainstorm' },
    ],
  },
  {
    id: 'planning_style',
    icon: '📅',
    label: 'What best describes your planning style?',
    dbColumn: 'what_best_describes_your_planning_style',
    options: [
      { id: 'flow', label: 'Go-with-the-flow', dbValue: 'flow' },
      { id: 'plan_little', label: 'I plan a little', dbValue: 'plan_little' },
      { id: 'organise', label: 'I like to organise things', dbValue: 'organise' },
      { id: 'mini_project', label: 'I plan dates like a mini project', dbValue: 'mini_project' },
    ],
  },
  {
    id: 'relationship_commitments',
    icon: '🤝',
    label: 'How do you handle commitments in a relationship?',
    dbColumn: 'how_do_you_handle_commitments_in_a_relationship',
    options: [
      { id: 'forget_sometimes', label: 'I forget sometimes', dbValue: 'forget_sometimes' },
      { id: 'try_remember', label: 'I try my best to remember', dbValue: 'try_remember' },
      { id: 'responsible_steady', label: "I'm responsible and steady", dbValue: 'responsible_steady' },
      { id: 'no_excuses', label: "If I promise, I'll do it—no excuses", dbValue: 'no_excuses' },
    ],
  },
];

export default function OnboardingQues8Screen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  // State maps question index to selected option value
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const handleSelect = (questionId: string, optionValue: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionValue,
    }));
  };

  const answeredCount = Object.keys(answers).length;

  const handleNext = async () => {
    if (answeredCount < QUESTIONS.length) {
      Alert.alert('Incomplete Questions', 'Please answer all 5 questions to continue.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Convert answers state object to database row values
      const payload: any = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      QUESTIONS.forEach(q => {
        const val = answers[q.id];
        if (q.isMultiple) {
          payload[q.dbColumn] = [val]; // TEXT[] requires an array
        } else {
          payload[q.dbColumn] = val;
        }
      });

      // Upsert preferences to personality_qns table
      const { error } = await supabase.from('personality_qns').upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      // Proceed to Page 9 of 10
      router.push('/onboarding-ques-09');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'An unexpected error occurred while saving your habits.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={bgSource}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={14} />

      <ScrollView
        style={styles.scrollStyle}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 25 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          
          {/* Progress bar — Page 8 of 10 indicator */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              {Array.from({ length: 10 }).map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.progressSegment,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' },
                    idx < 8 && styles.progressSegmentActive,
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.progressText, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Page 8 of 10</Text>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Let&apos;s talk lifestyle habits</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
              Do their habits match yours? You go first.
            </Text>
          </View>

          {/* Questions Container */}
          <View style={styles.questionsContainer}>
            {QUESTIONS.map((q) => {
              return (
                <View key={q.id} style={styles.questionBlock}>
                  {/* Label Row */}
                  <View style={styles.questionLabelRow}>
                    <Text style={styles.questionIcon}>{q.icon}</Text>
                    <Text style={[styles.questionText, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>{q.label}</Text>
                  </View>

                  {/* Options List */}
                  <View style={styles.optionsList}>
                    {q.options.map((opt) => {
                      const isSelected = answers[q.id] === opt.dbValue;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => handleSelect(q.id, opt.dbValue)}
                          style={[
                            styles.optionPill,
                            {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                              borderColor: isSelected
                                ? (isDark ? '#A855F7' : '#4B0082')
                                : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB'),
                            },
                            isSelected && {
                              backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : '#F3ECFF',
                            }
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionLabel,
                              { color: isDark ? '#C9C3DE' : '#6B7280' },
                              isSelected && { color: isDark ? '#FFFFFF' : '#4B0082' }
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {isSelected && <Text style={[styles.checkmarkIcon, { color: isDark ? '#B57BFF' : '#4B0082' }]}>✓</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Bottom Nav Area */}
          <View style={styles.bottomNav}>
            {/* Back Button */}
            <Pressable
              id="btn-back-page8"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backNavBtn, { backgroundColor: isDark ? 'rgba(20, 12, 40, 0.55)' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E5E7EB' }, pressed && styles.backNavBtnPressed]}
            >
              <Text style={[styles.backNavArrow, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>←</Text>
            </Pressable>

            {/* Action Continue Button */}
            <Pressable
              id="btn-habits-continue"
              onPress={handleNext}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionPressed,
                answeredCount < QUESTIONS.length && styles.actionButtonDisabled
              ]}
              disabled={loading || answeredCount < QUESTIONS.length}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>Next {answeredCount} / 5  →</Text>
              )}
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  scrollStyle: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  container: { flex: 1, paddingHorizontal: 24 },

  // ── Progress Bar ──
  progressSection: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 32,
  },
  progressRow: {
    flexDirection: 'row',
    width: '100%',
    height: 4,
    gap: 6,
    marginBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#B57BFF',
  },
  progressText: {
    color: '#9A93B5',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },

  // ── Header ──
  header: { alignItems: 'flex-start', width: '100%', marginBottom: 12 },
  heading: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'left',
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  subtitle: {
    color: '#9A93B5',
    fontSize: 14,
    textAlign: 'left',
    opacity: 0.85,
    lineHeight: 20,
  },

  // ── Questions List ──
  questionsContainer: {
    width: '100%',
    gap: 28,
    marginTop: 10,
  },
  questionBlock: {
    width: '100%',
    gap: 12,
  },
  questionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  questionIcon: {
    fontSize: 20,
    color: '#B57BFF',
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    lineHeight: 22,
  },
  optionsList: {
    width: '100%',
    gap: 8,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionPillSelected: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  optionLabel: {
    color: '#C9C3DE',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  optionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  checkmarkIcon: {
    color: '#B57BFF',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 10,
  },

  // ── Bottom Navigation Row ──
  bottomNav: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    gap: 16,
    marginTop: 36,
  },
  backNavBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backNavBtnPressed: {
    opacity: 0.7,
  },
  backNavArrow: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },

  // ── Action Button ──
  actionButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(90deg, #7C3AED, #C026D3)',
    ...Platform.select({
      ios: { shadowColor: '#C026D3', shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 28px 0 rgba(192,38,211,0.55)' } as any,
    }),
  } as any,
  actionButtonDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    experimental_backgroundImage: 'none',
  } as any,
  actionPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
