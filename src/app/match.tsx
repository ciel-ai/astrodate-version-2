import { useCallback } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Ellipse, G, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import Glitters from '@/components/glitters';
import { useOnboardingFonts } from '@/hooks/use-onboarding-fonts';
import { useProfileData } from '@/hooks/use-profile-data';

const DEFAULT_MY_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400';
const DEFAULT_OTHER_AVATAR = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400';

export default function MatchScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fontsLoaded = useOnboardingFonts();
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';

  // Route parameters
  const { channelId, otherUserId, otherUserName, otherUserPhoto } = useLocalSearchParams<{
    matchId: string;
    channelId: string;
    otherUserId: string;
    otherUserName: string;
    otherUserPhoto: string;
  }>();

  // Current user profile data
  const { profile } = useProfileData();

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;
  const deviceW = isDesktopWeb ? 390 : screenW;
  const deviceH = isDesktopWeb ? 844 : screenH;

  // Resolve background source
  const bgSource = isDark 
    ? require('@/assets/images/match-bg.png') 
    : require('@/assets/images/onboard-light-bg.png');

  // Resolve profile pictures
  const myPhotoUrl = profile?.photos?.find((p) => p.is_primary)?.photo_url 
    || profile?.photos?.[0]?.photo_url 
    || null;

  const myPhotoSource = myPhotoUrl 
    ? { uri: myPhotoUrl } 
    : { uri: DEFAULT_MY_AVATAR };

  const otherPhotoSource = otherUserPhoto === 'mock-dinesh'
    ? require('@/assets/images/dinesh.png')
    : (otherUserPhoto && otherUserPhoto.startsWith('http')
        ? { uri: otherUserPhoto }
        : (otherUserPhoto ? { uri: otherUserPhoto } : { uri: DEFAULT_OTHER_AVATAR }));

  const handleSendMessage = useCallback(() => {
    // Replace current route with the chat route so we don't return to the match page on back press
    router.replace({
      pathname: '/chat/[channelId]',
      params: {
        channelId: channelId ?? '',
        otherUserId: otherUserId ?? '',
        otherUserName: otherUserName ?? 'Someone',
        otherUserPhoto: otherUserPhoto ?? '',
      },
    } as any);
  }, [channelId, otherUserId, otherUserName, otherUserPhoto]);

  const handleKeepDiscovering = useCallback(() => {
    router.back();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#09031C' : '#FFFFFF' }} />;
  }

  const textColor = isDark ? '#FFFFFF' : '#1E1B4B';
  const primaryPurple = isDark ? '#8B5CF6' : '#7C3AED';

  return (
    <View style={[styles.outerContainer, { width: screenW, height: screenH, backgroundColor: isDark ? '#09031C' : '#FFFFFF' }]}>
      <ImageBackground
        source={bgSource}
        style={[styles.bgImage, { width: deviceW, height: deviceH }]}
        resizeMode="cover"
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {isDark && <Glitters count={26} />}

        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
          
          {/* Heading / Subheading */}
          <View style={[styles.textContainer, { marginTop: Math.round(deviceH * 0.05) }]}>
            <Text style={[styles.subtitle, { color: textColor }]}>
              The stars aligned{'\n'}
              <Text style={[styles.subtitleNormal, { color: textColor }]}>and </Text>
              <Text style={styles.subtitleAccent}>you found each other.</Text>
            </Text>
          </View>

          {/* Overlapping Avatars Section */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatarContainer, styles.leftAvatar]}>
              <Image source={myPhotoSource} style={styles.avatarImage} />
            </View>

            <View style={[styles.avatarContainer, styles.rightAvatar]}>
              <Image source={otherPhotoSource} style={styles.avatarImage} />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.messageBtnContainer,
                pressed && styles.btnPressed,
              ]}
              onPress={handleSendMessage}
            >
              <LinearGradient
                colors={['#C026D3', '#7C3AED', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.messageBtnGradient}
              >
                <View style={styles.btnIconBadge}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: '-45deg' }, { translateX: 1.5 }, { translateY: -1.5 }] }}>
                    <Path
                      d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                      fill="#7C3AED"
                    />
                  </Svg>
                </View>
                <Text style={styles.messageBtnText}>Send a Message</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.discoverBtnContainer,
                pressed && styles.btnPressed,
              ]}
              onPress={handleKeepDiscovering}
            >
              <LinearGradient
                colors={['#FF3B8B', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.discoverBtnGradient}
              >
                <View style={[styles.discoverBtnInner, { backgroundColor: isDark ? '#09031C' : '#FFFFFF' }]}>
                  <View style={styles.discoverBtnIcon}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill={primaryPurple}>
                      <Path
                        d="M9.937 15.51a1.18 1.18 0 0 0 1.906 0l.477-.665a8.07 8.07 0 0 1 3.652-2.924l.792-.327a1.18 1.18 0 0 0 0-2.188l-.792-.327a8.07 8.07 0 0 1-3.652-2.924l-.477-.665a1.18 1.18 0 0 0-1.906 0l-.477.665a8.07 8.07 0 0 1-3.652 2.924l-.792.327a1.18 1.18 0 0 0 0 2.188l.792.327a8.07 8.07 0 0 1 3.652 2.924l.477.665ZM19 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM20 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM4 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                      />
                    </Svg>
                  </View>
                  <Text style={[styles.discoverBtnText, { color: primaryPurple }]}>Keep Discovering</Text>
                </View>
              </LinearGradient>
            </Pressable>
          </View>

        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgImage: {
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  glyphContainer: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    top: 35,
  },
  subtitle: {
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
    fontWeight: '700',
  },
  subtitleNormal: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subtitleAccent: {
    fontSize: 24,
    color: '#FF2A85',
    fontWeight: '700',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 180,
    width: '100%',
  },
  avatarContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#1E1538',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      default: {
        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.18)',
      },
    }),
  },
  leftAvatar: {
    marginRight: -25,
    zIndex: 2,
  },
  rightAvatar: {
    marginLeft: -25,
    zIndex: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 76,
    resizeMode: 'cover',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  messageBtnContainer: {
    width: 300,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  messageBtnGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  btnIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 10,
  },
  messageBtnText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  discoverBtnContainer: {
    width: 300,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  discoverBtnGradient: {
    width: '100%',
    height: '100%',
    padding: 1.5,
  },
  discoverBtnInner: {
    flex: 1,
    backgroundColor: '#09031C',
    borderRadius: 26.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  discoverBtnIcon: {
    position: 'absolute',
    left: 20,
  },
  discoverBtnText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
