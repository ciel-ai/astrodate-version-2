import { useRef, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';
import { getAstroDetails, parseTzString } from '@/lib/astro';
import { searchBirthPlace, getTimezoneOffset } from '@/lib/astro-geo';

type PlaceResult = { place_name: string; latitude: number; longitude: number; timezone_id: string };

const SERIF = 'Baskerville-Old-Face';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BirthDetailsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  // State values
  const [day, setDay] = useState('');
  const [month, setMonth] = useState(1); // 1-12
  const [year, setYear] = useState('');
  
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [isAm, setIsAm] = useState(true); // true = AM, false = PM

  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [timezoneId, setTimezoneId] = useState<string | null>(null);

  // Place-of-birth autocomplete (AstrologyAPI geo_details via astro-geo edge fn)
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  // Temporary picker modal states
  const [tempDay, setTempDay] = useState('01');
  const [tempMonth, setTempMonth] = useState(1);
  const [tempYear, setTempYear] = useState('1998');

  const [tempHour, setTempHour] = useState('12');
  const [tempMinute, setTempMinute] = useState('00');
  const [tempIsAm, setTempIsAm] = useState(true);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;
  const deviceH = isDesktopWeb ? 844 : screenH;
  const FORM_GAP = Math.round(deviceH * 0.04);

  // Formatting displays
  const dateDisplay = day && year ? `${day} ${MONTHS[month - 1]} ${year}` : 'Select date';
  const timeDisplay = hour && minute ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')} ${isAm ? 'AM' : 'PM'}` : 'Select time';

  // Open Pickers
  const openDatePicker = () => {
    setTempDay(day || '01');
    setTempMonth(month || 1);
    setTempYear(year || '1998');
    setDateModalVisible(true);
  };

  const openTimePicker = () => {
    setTempHour(hour || '12');
    setTempMinute(minute || '00');
    setTempIsAm(isAm);
    setTimeModalVisible(true);
  };

  // Confirm Selection
  const confirmDate = () => {
    const dNum = parseInt(tempDay, 10);
    const yNum = parseInt(tempYear, 10);

    if (isNaN(dNum) || dNum < 1 || dNum > 31) {
      Alert.alert('Invalid Day', 'Please enter a day between 1 and 31.');
      return;
    }
    if (isNaN(yNum) || yNum < 1920 || yNum > new Date().getFullYear()) {
      Alert.alert('Invalid Year', `Please enter a year between 1920 and ${new Date().getFullYear()}.`);
      return;
    }

    setDay(tempDay.padStart(2, '0'));
    setMonth(tempMonth);
    setYear(tempYear);
    setDateModalVisible(false);
  };

  const confirmTime = () => {
    const hNum = parseInt(tempHour, 10);
    const mNum = parseInt(tempMinute, 10);

    if (isNaN(hNum) || hNum < 1 || hNum > 12) {
      Alert.alert('Invalid Hour', 'Please enter hours between 1 and 12.');
      return;
    }
    if (isNaN(mNum) || mNum < 0 || mNum > 59) {
      Alert.alert('Invalid Minute', 'Please enter minutes between 0 and 59.');
      return;
    }

    setHour(tempHour.padStart(2, '0'));
    setMinute(tempMinute.padStart(2, '0'));
    setIsAm(tempIsAm);
    setTimeModalVisible(false);
  };

  // ── Place-of-birth autocomplete via astro-geo (geo_details) ──
  const handlePlaceChange = (text: string) => {
    setPlaceOfBirth(text);
    // Typing invalidates any previously-resolved coordinates until re-picked.
    setLat(null);
    setLng(null);
    setTimezoneId(null);

    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = text.trim();
    if (q.length < 3) {
      setPlaceSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearchingPlace(true);
    setShowSuggestions(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchBirthPlace(q);
      if (seq !== searchSeq.current) return; // a newer keystroke superseded this one
      setSearchingPlace(false);
      setPlaceSuggestions(results ?? []);
      setShowSuggestions(true);
    }, 400);
  };

  const handleSelectPlace = (item: PlaceResult) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchSeq.current++; // cancel any in-flight search
    setPlaceOfBirth(item.place_name);
    setLat(item.latitude);
    setLng(item.longitude);
    setTimezoneId(item.timezone_id);
    setPlaceSuggestions([]);
    setShowSuggestions(false);
    setSearchingPlace(false);
  };

  // Geolocate
  const handleUseCurrentLocation = async () => {
    setLocLoading(true);
    setShowSuggestions(false);
    setPlaceSuggestions([]);
    searchSeq.current++;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location permissions to use current location.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
      setTimezoneId(null); // resolved precisely at submit via getTimezoneOffset

      // Simple reverse geocoding
      const geo = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });

      if (geo && geo.length > 0) {
        const item = geo[0];
        const placeName = [item.city || item.subregion || item.district, item.country]
          .filter(Boolean)
          .join(', ');
        setPlaceOfBirth(placeName);
      } else {
        setPlaceOfBirth(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
      }
    } catch (e) {
      console.warn('Geocoding failed:', e);
      Alert.alert('Error', 'Could not fetch your current location coordinates.');
    } finally {
      setLocLoading(false);
    }
  };

  // Submit flow
  const handleGenerateAstro = async () => {
    if (!day || !year) {
      Alert.alert('Date Required', 'Please select your Date of Birth.');
      return;
    }
    if (!hour || !minute) {
      Alert.alert('Time Required', 'Please select your Time of Birth.');
      return;
    }
    if (!placeOfBirth.trim()) {
      Alert.alert('Place Required', 'Please enter your Place of Birth.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Convert 12h to 24h format for Postgres TIME type
      let hours24 = parseInt(hour, 10);
      if (!isAm && hours24 !== 12) hours24 += 12;
      if (isAm && hours24 === 12) hours24 = 0;

      const dayNum = parseInt(day, 10);
      const minNum = parseInt(minute, 10);
      const formattedTime = `${String(hours24).padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
      const formattedDate = `${year}-${String(month).padStart(2, '0')}-${day}`;
      const birthDate = new Date(parseInt(year, 10), month - 1, dayNum);

      // ── 1. Resolve accurate birth coordinates via the geo endpoint ──
      // If the user picked a suggestion or used GPS we already have lat/lng.
      // Otherwise geocode the typed place name so astro calc never runs blind.
      let resolvedLat = lat;
      let resolvedLng = lng;
      let resolvedTzId = timezoneId;
      const placeQuery = placeOfBirth.trim();

      // (a) AstrologyAPI geonames search (also gives us the timezone id).
      if (resolvedLat == null || resolvedLng == null) {
        const results = await searchBirthPlace(placeQuery);
        if (results && results.length > 0) {
          resolvedLat = results[0].latitude;
          resolvedLng = results[0].longitude;
          resolvedTzId = results[0].timezone_id;
        }
      }

      // (b) Device geocoder fallback — handles colloquial/short names that
      // geonames misses (e.g. "Trichy" → Tiruchirappalli).
      if (resolvedLat == null || resolvedLng == null) {
        try {
          const geo = await Location.geocodeAsync(placeQuery);
          if (geo && geo.length > 0) {
            resolvedLat = geo[0].latitude;
            resolvedLng = geo[0].longitude;
          }
        } catch (geoErr) {
          console.warn('Device geocode fallback failed:', geoErr);
        }
      }

      if (resolvedLat == null || resolvedLng == null) {
        Alert.alert(
          'Place Not Found',
          'We could not locate that place. Try the full city name (e.g. "Tiruchirappalli" instead of "Trichy"), pick a suggestion from the list, or use your current location.'
        );
        setLoading(false);
        return;
      }

      // ── 2. Resolve the DST-correct timezone offset for the birth place & date ──
      // The device timezone is wrong for a birth elsewhere; the geo timezone API
      // returns the historically-correct offset (incl. DST) for the birth moment.
      let tzOffset = await getTimezoneOffset(resolvedLat, resolvedLng, birthDate);
      const deviceTzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'GMT';
      if (tzOffset == null) tzOffset = parseTzString(deviceTzName);

      // ── 3. Fetch computed zodiac details from the astro edge function ──
      let computed = null;
      try {
        computed = await getAstroDetails({
          day: dayNum,
          month: month,
          year: parseInt(year, 10),
          hour: hours24,
          min: minNum,
          lat: resolvedLat,
          lon: resolvedLng,
          tzone: tzOffset,
          mode: 'basic'
        });
      } catch (err) {
        console.warn('Astrology details fetch failed (will save raw fields):', err);
      }

      const { error } = await supabase.from('astro_details').upsert(
        {
          user_id: user.id,
          birth_date: formattedDate,
          birth_time: formattedTime,
          birth_location: placeOfBirth.trim(),
          birth_latitude: resolvedLat,
          birth_longitude: resolvedLng,
          birth_timezone: resolvedTzId || deviceTzName,

          // Computed fields from AstrologyAPI
          western_sign: computed?.western_sign || null,
          venus_sign: computed?.venus_sign || null,
          mars_sign: computed?.mars_sign || null,
          mercury_sign: computed?.mercury_sign || null,
          rising_sign: computed?.rising_sign || null,
          dominant_element: computed?.dominant_element || null,
          indian_sign: computed?.indian_sign || null,
          nakshatra_name: computed?.nakshatra_name || null,
          chart_json: computed?.chart_json || null,

          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      router.push('/cosmic-identity');
    } catch (e: any) {
      Alert.alert('Setup Failed', e.message || 'An unexpected error occurred while generating your astro details.');
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

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: Math.max(insets.top, 16) }]}
        hitSlop={10}
      >
        <Text style={[styles.backIcon, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>‹</Text>
      </Pressable>

      <ScrollView
        style={styles.scrollStyle}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 60 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Steps Horizontal Bar Indicator — step 4 of 4 */}
          <View style={styles.progressRow}>
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, styles.progressSegmentActive]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Your Birth Details</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
              Help us create your personalized astro profile
            </Text>
          </View>

          {/* Form Content */}
          <View style={[styles.form, { marginTop: FORM_GAP }]}>
            
            {/* DATE OF BIRTH */}
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Date of Birth</Text>
              
              <Pressable 
                id="btn-select-dob"
                style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB' }]} 
                onPress={openDatePicker}
              >
                <Text style={[styles.inputText, { color: isDark ? '#FFFFFF' : '#1B1528' }, !day && { color: isDark ? '#7C7796' : '#9CA3AF' }]}>
                  {dateDisplay}
                </Text>
                <Text style={styles.inputIconEmoji}>📅</Text>
              </Pressable>

              <View style={styles.hintContainer}>
                <Text style={styles.hintIcon}>ℹ️</Text>
                <Text style={[styles.hintText, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
                  Please enter your correct date of birth, it ensures precise astrological calculations and compatibility matching.
                </Text>
              </View>
            </View>

            {/* TIME OF BIRTH */}
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Time of Birth</Text>
              
              <Pressable 
                id="btn-select-tob"
                style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB' }]} 
                onPress={openTimePicker}
              >
                <Text style={[styles.inputText, { color: isDark ? '#FFFFFF' : '#1B1528' }, !hour && { color: isDark ? '#7C7796' : '#9CA3AF' }]}>
                  {timeDisplay}
                </Text>
                <Text style={styles.inputIconEmoji}>🕒</Text>
              </Pressable>

              <View style={styles.hintContainer}>
                <Text style={styles.hintIcon}>ℹ️</Text>
                <Text style={[styles.hintText, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
                  Your exact birth time helps us generate accurate astrological insights
                </Text>
              </View>
            </View>

            {/* PLACE OF BIRTH */}
            <View style={styles.fieldSection}>
              <View style={styles.labelRow}>
                <Text style={[styles.fieldLabel, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Place of Birth</Text>
                
                <Pressable 
                  id="btn-birth-use-loc"
                  style={[
                    styles.useLocBtn,
                    {
                      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.12)' : 'rgba(75, 0, 130, 0.06)',
                      borderColor: isDark ? 'rgba(168, 85, 247, 0.25)' : 'rgba(75, 0, 130, 0.15)',
                    }
                  ]} 
                  onPress={handleUseCurrentLocation}
                  disabled={locLoading}
                >
                  {locLoading ? (
                    <ActivityIndicator size="small" color={isDark ? "#A855F7" : "#4B0082"} />
                  ) : (
                    <Text style={[styles.useLocText, { color: isDark ? '#D4B8FF' : '#4B0082' }]}>🎯 Use Current Location</Text>
                  )}
                </Pressable>
              </View>

              <View style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB' }]}>
                <TextInput
                  value={placeOfBirth}
                  onChangeText={handlePlaceChange}
                  placeholder="Enter city / birth town"
                  placeholderTextColor={isDark ? "#7C7796" : "#9CA3AF"}
                  style={[styles.textInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
                  accessibilityLabel="Place of Birth"
                  autoCorrect={false}
                />
                {searchingPlace ? (
                  <ActivityIndicator size="small" color={isDark ? '#A855F7' : '#4B0082'} />
                ) : lat != null && lng != null ? (
                  <Text style={styles.placeResolvedIcon}>✓</Text>
                ) : null}
              </View>

              {/* Autocomplete suggestions (from AstrologyAPI geo_details) */}
              {showSuggestions && placeSuggestions.length > 0 && (
                <View
                  style={[
                    styles.suggestionsBox,
                    {
                      backgroundColor: isDark ? '#150C2E' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB',
                    },
                  ]}
                >
                  {placeSuggestions.map((item, idx) => (
                    <Pressable
                      key={`${item.place_name}-${item.latitude}-${item.longitude}-${idx}`}
                      onPress={() => handleSelectPlace(item)}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        idx < placeSuggestions.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F4',
                        },
                        pressed && { backgroundColor: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(75,0,130,0.06)' },
                      ]}
                    >
                      <Text style={styles.suggestionPin}>📍</Text>
                      <Text
                        style={[styles.suggestionText, { color: isDark ? '#EDE9FF' : '#1B1528' }]}
                        numberOfLines={1}
                      >
                        {item.place_name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Action Submit Button */}
            <Pressable
              id="btn-generate-astro"
              onPress={handleGenerateAstro}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>Generate Your Astro Profile ✨</Text>
              )}
            </Pressable>

          </View>
        </View>
      </ScrollView>

      {/* ── DATE PICKER MODAL ── */}
      <Modal
        visible={dateModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? '#0F0924' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
            }
          ]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Select Date of Birth</Text>

            <View style={styles.pickerRow}>
              {/* Day Input */}
              <View style={styles.pickerField}>
                <Text style={[styles.pickerLabel, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Day</Text>
                <TextInput
                  value={tempDay}
                  onChangeText={setTempDay}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="DD"
                  placeholderTextColor={isDark ? "#5A5478" : "#9CA3AF"}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9F9FB',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                      color: isDark ? '#FFFFFF' : '#1B1528',
                    }
                  ]}
                />
              </View>

              {/* Month Dropdown / Selection */}
              <View style={[styles.pickerField, { flex: 2 }]}>
                <Text style={[styles.pickerLabel, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Month</Text>
                <ScrollView 
                  style={[
                    styles.monthScroll,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9F9FB',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                    }
                  ]} 
                  nestedScrollEnabled={true}
                >
                  {MONTHS.map((mName, idx) => {
                    const active = tempMonth === idx + 1;
                    return (
                      <Pressable
                        key={mName}
                        onPress={() => setTempMonth(idx + 1)}
                        style={[styles.monthItem, active && styles.monthItemActive]}
                      >
                        <Text 
                          style={[
                            styles.monthItemText,
                            { color: isDark ? '#9A93B5' : '#6B7280' },
                            active && { color: isDark ? '#D4B8FF' : '#4B0082', fontWeight: '700' }
                          ]}
                        >
                          {mName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Year Input */}
              <View style={styles.pickerField}>
                <Text style={[styles.pickerLabel, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Year</Text>
                <TextInput
                  value={tempYear}
                  onChangeText={setTempYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="YYYY"
                  placeholderTextColor={isDark ? "#5A5478" : "#9CA3AF"}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9F9FB',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                      color: isDark ? '#FFFFFF' : '#1B1528',
                    }
                  ]}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Pressable 
                style={[
                  styles.modalCancel,
                  {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                  }
                ]} 
                onPress={() => setDateModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={confirmDate}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── TIME PICKER MODAL ── */}
      <Modal
        visible={timeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTimeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? '#0F0924' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
            }
          ]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Select Time of Birth</Text>

            <View style={styles.pickerRow}>
              {/* Hour Input */}
              <View style={styles.pickerField}>
                <Text style={[styles.pickerLabel, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Hour</Text>
                <TextInput
                  value={tempHour}
                  onChangeText={setTempHour}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="12"
                  placeholderTextColor={isDark ? "#5A5478" : "#9CA3AF"}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9F9FB',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                      color: isDark ? '#FFFFFF' : '#1B1528',
                    }
                  ]}
                />
              </View>

              <Text style={[styles.timeColon, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>:</Text>

              {/* Minute Input */}
              <View style={styles.pickerField}>
                <Text style={[styles.pickerLabel, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Minute</Text>
                <TextInput
                  value={tempMinute}
                  onChangeText={setTempMinute}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor={isDark ? "#5A5478" : "#9CA3AF"}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9F9FB',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                      color: isDark ? '#FFFFFF' : '#1B1528',
                    }
                  ]}
                />
              </View>

              {/* AM/PM Switch */}
              <View style={styles.pickerField}>
                <Text style={[styles.pickerLabel, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Period</Text>
                <View 
                  style={[
                    styles.ampmWrap,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9F9FB',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                    }
                  ]}
                >
                  <Pressable
                    onPress={() => setTempIsAm(true)}
                    style={[styles.ampmBtn, tempIsAm && styles.ampmBtnActive]}
                  >
                    <Text style={[styles.ampmText, tempIsAm && styles.ampmTextActive, { color: isDark ? '#9A93B5' : '#6B7280' }, tempIsAm && { color: '#FFFFFF' }]}>AM</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTempIsAm(false)}
                    style={[styles.ampmBtn, !tempIsAm && styles.ampmBtnActive]}
                  >
                    <Text style={[styles.ampmText, !tempIsAm && styles.ampmTextActive, { color: isDark ? '#9A93B5' : '#6B7280' }, !tempIsAm && { color: '#FFFFFF' }]}>PM</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Pressable 
                style={[
                  styles.modalCancel,
                  {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                  }
                ]} 
                onPress={() => setTimeModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: isDark ? '#9A93B5' : '#6B7280' }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={confirmTime}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  scrollStyle: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  container: { flex: 1, paddingHorizontal: 24 },

  backBtn: {
    position: 'absolute',
    left: 18,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: '#FFFFFF', fontSize: 26, lineHeight: 28, marginTop: -2 },

  // ── Progress bar ──
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
    gap: 8,
  },
  progressSegment: {
    width: 50,
    height: 4,
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#B57BFF',
  },

  // ── Header ──
  header: { alignItems: 'center', width: '100%' },
  heading: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  subtitle: {
    color: '#9A93B5',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.85,
    marginBottom: 24,
    lineHeight: 20,
  },

  // ── Form Panel ──
  form: { alignItems: 'stretch', width: '100%', gap: 20 },

  fieldSection: { gap: 8 },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // ── Input Fields ──
  inputContainer: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  placeholderText: {
    color: '#7C7796',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    height: '100%',
  },
  inputIconEmoji: {
    fontSize: 18,
    color: '#B57BFF',
  },
  placeResolvedIcon: {
    fontSize: 16,
    color: '#3DDC97',
    fontWeight: '800',
  },

  // ── Place autocomplete suggestions ──
  suggestionsBox: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
      web: { boxShadow: '0 6px 20px rgba(0,0,0,0.25)' } as any,
    }),
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  suggestionPin: {
    fontSize: 14,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Hints ──
  hintContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    gap: 8,
  },
  hintIcon: {
    fontSize: 13,
    color: '#9A93B5',
    opacity: 0.7,
    marginTop: 2,
  },
  hintText: {
    flex: 1,
    color: '#9A93B5',
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.75,
  },

  // ── Location Button ──
  useLocBtn: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  useLocText: {
    color: '#D4B8FF',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Action Button ──
  actionButton: {
    height: 54,
    borderRadius: 27,
    marginTop: 15,
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
  actionPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  // ── Two Column row ──
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },

  // ── MODAL PICKER STYLES ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 3, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F0924',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  pickerField: {
    flex: 1,
    gap: 6,
  },
  pickerLabel: {
    color: '#9A93B5',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalInput: {
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  monthScroll: {
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  monthItem: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  monthItemActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  monthItemText: {
    color: '#9A93B5',
    fontSize: 14,
  },
  monthItemTextActive: {
    color: '#D4B8FF',
    fontWeight: '700',
  },
  timeColon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 18,
  },
  ampmWrap: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  ampmBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ampmBtnActive: {
    backgroundColor: '#7C3AED',
  },
  ampmText: {
    color: '#9A93B5',
    fontSize: 12,
    fontWeight: '700',
  },
  ampmTextActive: {
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#9A93B5',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    height: 46,
    backgroundColor: '#7C3AED',
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
