import { useState } from 'react';
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
}

const QUESTIONS: Question[] = [
  {
    id: 'show_care',
    icon: '❤️',
    label: 'How do you show care in a relationship?',
    dbColumn: 'how_do_you_show_care_in_a_relationship',
    options: [
      { id: 'small_gestures', label: 'Small gestures', dbValue: 'small_gestures' },
      { id: 'listening', label: 'Listening when needed', dbValue: 'listening' },
      { id: 'supporting_emotional', label: 'Supporting them emotionally', dbValue: 'supporting_emotional' },
      { id: 'make_loved', label: 'Going out of my way to make them feel loved', dbValue: 'make_loved' },
    ],
  },
  {
    id: 'partner_type',
    icon: '👥',
    label: 'What kind of partner are you?',
    dbColumn: 'what_kind_of_partner_are_you',
    options: [
      { id: 'independent', label: 'Independent', dbValue: 'independent' },
      { id: 'supportive_type', label: 'Supportive', dbValue: 'supportive' },
      { id: 'empathetic', label: 'Empathetic', dbValue: 'empathetic' },
      { id: 'comforting', label: 'Soft, kind, and comforting', dbValue: 'comforting' },
    ],
  },
  {
    id: 'replies_late',
    icon: '🕒',
    label: 'When your partner replies late, you feel...',
    dbColumn: 'when_your_partner_replies_late_you_feel',
    options: [
      { id: 'totally_fine', label: 'Totally fine', dbValue: 'totally_fine' },
      { id: 'slightly_curious', label: 'Slightly curious', dbValue: 'slightly_curious' },
      { id: 'overthinking', label: 'A bit overthinking', dbValue: 'overthinking' },
      { id: 'very_anxious', label: 'Very anxious', dbValue: 'very_anxious' },
    ],
  },
  {
    id: 'ups_downs',
    icon: '😊',
    label: 'How do you handle emotional ups and downs?',
    dbColumn: 'how_do_you_handle_emotional_ups_and_downs',
    options: [
      { id: 'rarely_stressed', label: 'I rarely feel stressed', dbValue: 'rarely_stressed' },
      { id: 'handle_okay', label: 'I handle things okay', dbValue: 'handle_okay' },
      { id: 'emotional_sometimes', label: 'I get emotional sometimes', dbValue: 'emotional_sometimes' },
      { id: 'feel_deeply', label: 'I feel things very deeply', dbValue: 'feel_deeply' },
    ],
  },
  {
    id: 'overthink_rel',
    icon: '🧠',
    label: 'How often do you overthink relationships?',
    dbColumn: 'how_often_do_you_overthink_relationships',
    options: [
      { id: 'almost_never', label: 'Almost never', dbValue: 'almost_never' },
      { id: 'occasionally', label: 'Occasionally', dbValue: 'occasionally' },
      { id: 'quite_often', label: 'Quite often', dbValue: 'quite_often' },
      { id: 'all_time', label: 'All the time', dbValue: 'all_time' },
    ],
  },
];

export default function OnboardingQues10Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

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
        payload[q.dbColumn] = val;
      });

      // Upsert preferences to personality_qns table
      const { error } = await supabase.from('personality_qns').upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      // Navigate to final transition screen
      router.push('/upload-photos' as any);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'An unexpected error occurred while saving your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/onboard-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" />
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
          
          {/* Progress bar — Page 10 of 10 indicator */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <View style={[styles.progressSegment, styles.progressSegmentActive]} />
              <View style={styles.progressSegmentEmpty} />
            </View>
            <Text style={styles.progressText}>Page 10 of 10</Text>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>Let&apos;s understand your relationship style</Text>
            <Text style={styles.subtitle}>
              Help us match you with compatible partners.
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
                    <Text style={styles.questionText}>{q.label}</Text>
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
                            isSelected && styles.optionPillSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionLabel,
                              isSelected && styles.optionLabelSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {isSelected && <Text style={styles.checkmarkIcon}>✓</Text>}
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
              id="btn-back-page10"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backNavBtn, pressed && styles.backNavBtnPressed]}
            >
              <Text style={styles.backNavArrow}>←</Text>
            </Pressable>

            {/* Action Continue Button with Heart Icon */}
            <Pressable
              id="btn-relationship-continue"
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
                <Text style={styles.actionText}>Next {answeredCount} / 5 🤍</Text>
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
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressSegment: {
    height: '100%',
    borderRadius: 2,
  },
  progressSegmentActive: {
    width: '100%', // 9 of 9 pages active (full progress)
    backgroundColor: '#B57BFF',
  },
  progressSegmentEmpty: {
    flex: 1,
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
