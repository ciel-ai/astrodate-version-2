import { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
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
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';

const SERIF = 'Baskerville-Old-Face';

const DEFAULT_REGION: Region = {
  latitude: 13.0827,
  longitude: 80.2707,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', emoji: '👨' },
  { id: 'female', label: 'Female', emoji: '👩' },
  { id: 'non-binary', label: 'Non-binary / Other', emoji: '✨' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [countryVal, setCountryVal] = useState('');
  const [neighborhood, setNeighborhood] = useState('Chennai');
  const [isLocating, setIsLocating] = useState(false);
  const [isLocated, setIsLocated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);

  const mapRef = useRef<MapView | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDetectedRef = useRef(false);

  const googleApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Recenter the native map on the given coordinate.
  const moveMapTo = (lat: number, lng: number) => {
    const newRegion: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setMapRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 600);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    let resolved = false;

    if (googleApiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`;
        const res = await fetch(url);
        const parsed = await res.json();
        if (parsed.status === 'OK' && parsed.results && parsed.results.length > 0) {
          const result = parsed.results[0];
          let sub = '', dist = '', st = '', co = '';
          result.address_components.forEach((comp: any) => {
            if (comp.types.includes('sublocality') || comp.types.includes('neighborhood') || comp.types.includes('sublocality_level_1')) sub = comp.long_name;
            if (comp.types.includes('administrative_area_level_2') || comp.types.includes('locality')) dist = comp.long_name;
            if (comp.types.includes('administrative_area_level_1')) st = comp.long_name;
            if (comp.types.includes('country')) co = comp.long_name;
          });
          const resolvedName = sub || dist || 'Selected Location';
          setNeighborhood(resolvedName);
          setAddress(resolvedName);
          setDistrict(dist); setStateVal(st); setCountryVal(co); setIsLocated(true);
          resolved = true;
        }
      } catch {}
    }

    if (!resolved) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'AstroDateMobileApp/1.0' } });
        const text = await res.text();
        if (res.ok) {
          const parsed = JSON.parse(text);
          if (parsed && parsed.address) {
            const addr = parsed.address;
            const suburb = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.city || '';
            const dist = addr.district || addr.county || addr.city_district || addr.suburb || addr.city || '';
            const resolvedName = suburb || dist || 'Selected Location';
            setNeighborhood(resolvedName);
            setAddress(resolvedName);
            setDistrict(dist); setStateVal(addr.state || ''); setCountryVal(addr.country || ''); setIsLocated(true);
          }
        }
      } catch {}
    }
  };

  const handleRegionChangeComplete = (region: Region) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => {
      reverseGeocode(region.latitude, region.longitude);
    }, 600);
  };

  const handleGPSLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to detect your position.');
        setIsLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      moveMapTo(latitude, longitude);
      await reverseGeocode(latitude, longitude);
    } catch {
      Alert.alert('Location Error', 'Unable to fetch your location. Please type your address manually.');
    } finally {
      setIsLocating(false);
    }
  };

  const performGeocoding = async (query: string) => {
    if (!query.trim() || query.trim().length < 5) {
      setDistrict('');
      setStateVal('');
      setCountryVal('');
      setIsLocated(false);
      return;
    }

    setIsLocating(true);
    let resolved = false;

    // 1. Try Google Geocoding API if key is present
    if (googleApiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleApiKey}`;
        const res = await fetch(url);
        const parsed = await res.json();
        if (parsed.status === 'OK' && parsed.results && parsed.results.length > 0) {
          const result = parsed.results[0];
          const { lat, lng } = result.geometry.location;
          let sub = '';
          let dist = '';
          let st = '';
          let co = '';

          result.address_components.forEach((comp: any) => {
            if (comp.types.includes('sublocality') || comp.types.includes('neighborhood') || comp.types.includes('sublocality_level_1')) {
              sub = comp.long_name;
            }
            if (comp.types.includes('administrative_area_level_2') || comp.types.includes('locality')) {
              dist = comp.long_name;
            }
            if (comp.types.includes('administrative_area_level_1')) {
              st = comp.long_name;
            }
            if (comp.types.includes('country')) {
              co = comp.long_name;
            }
          });

          setNeighborhood(sub || dist || 'Selected Location');
          setDistrict(dist);
          setStateVal(st);
          setCountryVal(co);
          setIsLocated(true);
          resolved = true;

          moveMapTo(lat, lng);
        }
      } catch (gErr) {
        console.log('Google Geocoding API failed, falling back:', gErr);
      }
    }

    // 2. Fallback to Nominatim OSM if Google Key is not present or query failed
    if (!resolved) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'AstroDateMobileAppClient/1.0 (contact@astrodateapp.com)'
          }
        });
        
        const resText = await res.text();
        if (res.ok) {
          try {
            const data = JSON.parse(resText);
            if (data && data.length > 0) {
              const addr = data[0].address;
              const dist = addr.district || addr.county || addr.city_district || addr.suburb || addr.city || '';
              const st = addr.state || '';
              const co = addr.country || '';
              const { lat, lon } = data[0];

              setNeighborhood(addr.suburb || addr.neighbourhood || addr.village || dist || 'Selected Location');
              setDistrict(dist);
              setStateVal(st);
              setCountryVal(co);
              setIsLocated(true);
              resolved = true;

              moveMapTo(parseFloat(lat), parseFloat(lon));
            }
          } catch (jsonErr) {
            console.log('JSON Parse error on OSM response:', jsonErr);
          }
        }
      } catch (err) {
        console.log('Network error during geocoding:', err);
      }
    }

    setIsLocating(false);

    // 3. String Split Fallback if geocoding yields no results
    if (!resolved) {
      const segments = query.split(',').map(s => s.trim()).filter(Boolean);
      let dist = '';
      let st = '';
      let co = 'India';

      if (segments.length >= 3) {
        co = segments[segments.length - 1] || '';
        st = segments[segments.length - 2] || '';
        dist = segments[segments.length - 3] || '';
      } else if (segments.length === 2) {
        dist = segments[0] || '';
        st = segments[1] || '';
      } else if (segments.length === 1 && segments[0].length > 3) {
        dist = segments[0] || '';
      }

      setDistrict(dist);
      setStateVal(st);
      setCountryVal(co);
      setIsLocated(true);

      // Best-effort coordinate from a known-city keyword match.
      let fallbackLat = 13.0827; // Chennai default
      let fallbackLng = 80.2707;
      const lowerQuery = query.toLowerCase();

      if (lowerQuery.includes('mumbai') || lowerQuery.includes('bombay')) {
        fallbackLat = 19.076; fallbackLng = 72.8777;
      } else if (lowerQuery.includes('delhi') || lowerQuery.includes('noida') || lowerQuery.includes('gurgaon')) {
        fallbackLat = 28.7041; fallbackLng = 77.1025;
      } else if (lowerQuery.includes('bangalore') || lowerQuery.includes('bengaluru')) {
        fallbackLat = 12.9716; fallbackLng = 77.5946;
      } else if (lowerQuery.includes('kolkata') || lowerQuery.includes('calcutta')) {
        fallbackLat = 22.5726; fallbackLng = 88.3639;
      } else if (lowerQuery.includes('hyderabad')) {
        fallbackLat = 17.385; fallbackLng = 78.4867;
      } else if (lowerQuery.includes('pune')) {
        fallbackLat = 18.5204; fallbackLng = 73.8567;
      }

      moveMapTo(fallbackLat, fallbackLng);
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    setIsLocated(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      performGeocoding(text);
    }, 1000);
  };

  // Auto-detect the user's location the first time they land on the Location step.
  useEffect(() => {
    if (step === 3 && !autoDetectedRef.current) {
      autoDetectedRef.current = true;
      handleGPSLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;
  const deviceH = isDesktopWeb ? 844 : screenH;

  // Render planet shifted up like in login and sign up screens
  const FORM_GAP = Math.round(deviceH * 0.08);


  const handleNext = async () => {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert('Name Required', 'Please enter your name to continue.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!gender) {
        Alert.alert('Gender Required', 'Please select a gender option to continue.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!address.trim()) {
        Alert.alert('Address Required', 'Please enter your address first.');
        return;
      }

      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Update auth user metadata
        const { error: metaErr } = await supabase.auth.updateUser({
          data: {
            display_name: name.trim(),
            gender: gender,
            location: district || neighborhood || address.trim(),
            address: address.trim(),
            district: district,
            state: stateVal,
            country: countryVal,
            onboarding_completed: true,
          },
        });

        if (metaErr) throw metaErr;

        // 2. Safely upsert user details in the profiles table if present
        if (user?.id) {
          try {
            await supabase.from('profiles').upsert({
              id: user.id,
              display_name: name.trim(),
              gender: gender,
              location: district || neighborhood || address.trim(),
              address: address.trim(),
              district: district,
              state: stateVal,
              country: countryVal,
              updated_at: new Date().toISOString(),
            });
          } catch (dbErr) {
            console.log('Skipped profiles database upsert:', dbErr);
          }
        }

        Alert.alert(
          'Setup Complete!',
          'Your profile has been configured successfully!',
          [
            {
              text: 'Let\'s Go! ✦',
              onPress: () => router.replace('/'),
            },
          ]
        );
      } catch (err: any) {
        Alert.alert('Setup Failed', err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.replace('/login');
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.heading}>What&apos;s your name?</Text>
            <Text style={styles.subtitle}>This will be displayed on your profile.</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#7C7796"
                style={styles.textInput}
                maxLength={40}
                autoFocus
              />
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.heading}>What describes you?</Text>
            <Text style={styles.subtitle}>
              Select what describes you to help us show your profile to the right people.
            </Text>

            <View style={styles.genderOptionsContainer}>
              {GENDER_OPTIONS.map((opt) => {
                const isSelected = gender === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setGender(opt.id)}
                    style={[
                      styles.genderCard,
                      isSelected && styles.genderCardSelected,
                    ]}
                  >
                    <Text style={styles.genderEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.genderLabel,
                        isSelected && styles.genderLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <View
                      style={[
                        styles.radioIndicator,
                        isSelected && styles.radioIndicatorSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.heading}>Location</Text>
            <Text style={styles.subtitle}>
              Only the neighborhood name will appear on your profile.
            </Text>

            {/* Underlined Address Search TextInput */}
            <View style={styles.underlineInputContainer}>
              <TextInput
                value={address}
                onChangeText={handleAddressChange}
                placeholder="Enter your address, neighborhood, or ZIP"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                style={styles.underlineInput}
                maxLength={100}
              />
            </View>

            {/* Native Google / Apple Map */}
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.mapWebview}
                initialRegion={DEFAULT_REGION}
                region={mapRegion}
                onRegionChangeComplete={handleRegionChangeComplete}
                mapType="standard"
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass={false}
                showsPointsOfInterests
                showsBuildings
                toolbarEnabled={false}
                provider={Platform.OS === 'android' ? 'google' : undefined}
              />

              {/* Fixed center pin overlay */}
              <View style={styles.markerOverlay} pointerEvents="none">
                <View style={styles.tooltipBubble}>
                  <Text style={styles.tooltipText}>{neighborhood}</Text>
                  <View style={styles.tooltipArrow} />
                </View>
                <Text style={styles.overlayPin}>📍</Text>
              </View>

              {/* Floating GPS lock button */}
              <Pressable style={styles.gpsButton} onPress={handleGPSLocation}>
                <Text style={styles.gpsIcon}>⌖</Text>
              </Pressable>
            </View>

            {isLocating && (
              <View style={styles.locatingContainer}>
                <ActivityIndicator color="#B57BFF" size="small" />
                <Text style={styles.locatingText}>Locating address details...</Text>
              </View>
            )}

            {isLocated && (district || stateVal || countryVal) && (
              <View style={styles.locationDetailsCard}>
                {district ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>District</Text>
                    <Text style={styles.detailValue}>{district}</Text>
                  </View>
                ) : null}
                {stateVal ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>State</Text>
                    <Text style={styles.detailValue}>{stateVal}</Text>
                  </View>
                ) : null}
                {countryVal ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Country</Text>
                    <Text style={styles.detailValue}>{countryVal}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/onboard-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <Glitters count={16} />

      {/* Back button */}
      <Pressable
        onPress={handleBack}
        style={[styles.backBtn, { top: Math.max(insets.top, 16) }]}
        hitSlop={10}
      >
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <ScrollView
        style={styles.scrollStyle}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 20) + 25 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Steps Horizontal Bar Indicator */}
          <View style={styles.progressRow}>
            <View style={[styles.progressSegment, step >= 1 && styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, step >= 2 && styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, step >= 3 && styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, step >= 4 && styles.progressSegmentActive]} />
          </View>

          {/* Step Body */}
          <View style={[styles.form, { marginTop: FORM_GAP }]}>
            {renderStepContent()}

            {/* Action button */}
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>
                  {step === 3 ? 'Complete Setup  →' : 'Next  →'}
                </Text>
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

  // ── Lockup ──
  lockup: { alignItems: 'center' },
  wordmark: { fontFamily: SERIF, color: '#FFFFFF' },
  sepRow: { flexDirection: 'row', alignItems: 'center', width: 150, marginTop: 2 },
  sepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.40)' },
  sepDiamond: {
    width: 6,
    height: 6,
    marginHorizontal: 8,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  tagline: {
    color: '#E6D8FF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
    opacity: 0.75,
    marginTop: 8,
  },

  // ── Step Indicators ──
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  progressSegmentActive: {
    backgroundColor: '#B57BFF',
  },

  // ── Form Panel ──
  form: { alignItems: 'stretch' },
  stepContainer: { width: '100%', alignItems: 'center' },
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
    marginBottom: 10,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
    color: '#A855F7',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    height: '100%',
  },

  // ── Gender Options ──
  genderOptionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 10,
  },
  genderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
  },
  genderCardSelected: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(30, 15, 60, 0.65)',
  },
  genderEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  genderLabel: {
    flex: 1,
    color: '#C9C3DE',
    fontSize: 15,
    fontWeight: '600',
  },
  genderLabelSelected: {
    color: '#FFFFFF',
  },
  radioIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioIndicatorSelected: {
    borderColor: '#B57BFF',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B57BFF',
  },

  // ── Action Button ──
  actionButton: {
    height: 54,
    borderRadius: 27,
    marginTop: 22,
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
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // ── Locate Map Styles ──
  locatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  locatingText: {
    color: '#9A93B5',
    fontSize: 14,
  },
  mapContainer: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
    marginBottom: 20,
  },
  mapWebview: {
    flex: 1,
    backgroundColor: '#e8eaed',
  },
  markerOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -100,
    marginTop: -80,
    width: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipBubble: {
    backgroundColor: 'rgba(15, 10, 30, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    marginBottom: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderLeftColor: 'transparent',
    borderRightWidth: 6,
    borderRightColor: 'transparent',
    borderTopWidth: 6,
    borderTopColor: 'rgba(15, 10, 30, 0.94)',
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
  },
  overlayPin: {
    fontSize: 32,
    marginTop: 2,
  },
  gpsButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15, 10, 30, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  underlineInputContainer: {
    width: '100%',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 8,
    marginBottom: 16,
  },
  underlineInput: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  locationDetailsCard: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#9A93B5',
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
