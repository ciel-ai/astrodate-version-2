import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';

const SERIF = 'Baskerville-Old-Face';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: deviceH } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const BG_SHIFT = Math.round(deviceH * 0.18);

  return (
    <ImageBackground
      source={require('@/assets/images/create-bg.png')}
      style={styles.bg}
      resizeMode="cover"
      imageStyle={{ transform: [{ scale: 1.38 }, { translateY: -BG_SHIFT }] }}
    >
      <StatusBar style="light" />
      <Glitters count={14} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 8 }]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <View style={styles.backChevron} />
      </Pressable>

      <View style={[styles.container, { paddingTop: insets.top + 50, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.lastUpdated}>Effective June 29, 2026</Text>

        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.paragraph}>
            This Privacy Policy applies to the Astro Date App operated by AstroDate Private Limited (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). Astro Date is a platform that combines astrology-based compatibility matching with a dating experience, helping users find meaningful connections through birth chart analysis and compatibility scores.
          </Text>
          <Text style={styles.paragraph}>
            By using the App, you agree to the collection and use of your information as described in this Privacy Policy.
          </Text>

          <Text style={styles.sectionTitle}>Information We Collect</Text>
          <Text style={styles.subSubTitle}>Personal Information</Text>
          <Text style={styles.paragraph}>When you register and use Astro Date, we collect:</Text>
          <Text style={styles.bullet}>• Full name, date of birth, time of birth, and place of birth (used for generating your birth chart and compatibility scores)</Text>
          <Text style={styles.bullet}>• Gender identity and relationship preferences</Text>
          <Text style={styles.bullet}>• Profile photographs and any additional media you upload</Text>
          <Text style={styles.bullet}>• Email address and/or mobile number</Text>
          <Text style={styles.bullet}>• A brief personal bio or description</Text>

          <Text style={styles.subSubTitle}>Location Data</Text>
          <Text style={styles.paragraph}>
            We collect your device&apos;s location to show you potential matches nearby. Location is used only for match suggestions and is never shared publicly on your profile without your consent.
          </Text>

          <Text style={styles.subSubTitle}>Controlling Your Location</Text>
          <Text style={styles.paragraph}>
            You can enable or disable location sharing at any time from the{' '}
            <Text style={styles.linkText}>Settings</Text> screen. When you disable location
            sharing, your stored location is deleted from our servers immediately and you
            will no longer appear with a distance label in other users&apos; discovery feeds.
            Re-enabling location requires granting permission again through the OS prompt.
          </Text>

          <Text style={styles.subSubTitle}>Usage Data</Text>
          <Text style={styles.paragraph}>We automatically collect:</Text>
          <Text style={styles.bullet}>• Device type, operating system, and IP address</Text>
          <Text style={styles.bullet}>• Pages and features accessed within the App</Text>
          <Text style={styles.bullet}>• Time and duration of App sessions</Text>
          <Text style={styles.bullet}>• Interactions such as likes, matches, and messages</Text>

          <Text style={styles.subSubTitle}>Communications</Text>
          <Text style={styles.paragraph}>
            Any messages exchanged between matched users on the platform are stored temporarily to enable the chat feature. We may review flagged communications solely for safety and moderation purposes.
          </Text>

          <Text style={styles.sectionTitle}>How We Use Your Information</Text>
          <Text style={styles.paragraph}>We use the information we collect to:</Text>
          <Text style={styles.bullet}>• Generate your Vedic or Western astrology birth chart</Text>
          <Text style={styles.bullet}>• Calculate compatibility scores between you and other users</Text>
          <Text style={styles.bullet}>• Suggest potential matches based on compatibility and location</Text>
          <Text style={styles.bullet}>• Enable profile display, messaging, and match interactions</Text>
          <Text style={styles.bullet}>• Send you notifications, updates, and relevant alerts</Text>
          <Text style={styles.bullet}>• Improve App performance and user experience through analytics</Text>
          <Text style={styles.bullet}>• Ensure platform safety by detecting fraud, abuse, or violations</Text>
          <Text style={styles.bullet}>• Comply with applicable legal obligations</Text>

          <Text style={styles.sectionTitle}>Birth Details and Astrological Data</Text>
          <Text style={styles.paragraph}>
            Your date, time, and place of birth are sensitive personal details used exclusively to generate your astrological profile and compatibility scores. This data:
          </Text>
          <Text style={styles.bullet}>• Is encrypted in storage and transmission</Text>
          <Text style={styles.bullet}>• Is never sold to third parties</Text>
          <Text style={styles.bullet}>• Is not displayed publicly on your profile (only your astrological profile summary such as sun sign or compatibility score may be visible to other users, as per your settings)</Text>
          <Text style={styles.bullet}>• May be used in anonymized, aggregated form for platform analytics and compatibility algorithm improvements</Text>

          <Text style={styles.sectionTitle}>Profile Photos and Media</Text>
          <Text style={styles.paragraph}>
            Profile photos are visible to other users on the platform as part of your dating profile. You retain ownership of all photos you upload. By uploading photos, you grant AstroDate Private Limited a limited, non-exclusive license to display them within the App for the purpose of operating the platform. We do not use your photos for advertising or share them with third parties.
          </Text>

          <Text style={styles.sectionTitle}>Sharing Your Information</Text>
          <Text style={styles.paragraph}>
            We do not sell your personal information. We may share your information only in the following circumstances:
          </Text>
          <Text style={styles.bullet}>• With other users: Your profile information (name, photos, astrological summary, bio) is visible to other users as part of normal platform operation</Text>
          <Text style={styles.bullet}>• With service providers: Trusted third-party providers who assist in operating the App (payment processors, analytics, cloud storage) and who are bound by confidentiality obligations</Text>
          <Text style={styles.bullet}>• For legal compliance: When required by law, court order, or government authority</Text>
          <Text style={styles.bullet}>• For safety: When we believe disclosure is necessary to prevent fraud, harm, or illegal activity</Text>
          <Text style={styles.bullet}>• In a business transfer: In the event of a merger, acquisition, or sale of assets, your data may be transferred with appropriate notice to you</Text>

          <Text style={styles.sectionTitle}>Third-Party Services</Text>
          <Text style={styles.paragraph}>
            The App uses the following third-party services, each governed by their own privacy policies:
          </Text>
          <Text style={styles.bullet}>• Google Play Services</Text>
          <Text style={styles.bullet}>• Razorpay — used as our payment gateway for processing transactions</Text>
          <Text style={styles.bullet}>• Supabase — used for cloud storage, database, and backend hosting</Text>
          <Text style={styles.bullet}>• Analytics providers — to be confirmed in a future update</Text>
          <Text style={styles.paragraph}>
            Payment gateway integrations beyond Razorpay, and additional analytics or service providers, may be introduced in future updates. This section will be updated accordingly when such changes are made, and users will be notified through the App or by email.
          </Text>

          <Text style={styles.sectionTitle}>Data Retention</Text>
          <Text style={styles.paragraph}>
            We retain your personal data for as long as your account is active. If you delete your account, your personal data including birth details, photos, and messages will be deleted within 30 days, except where retention is required by applicable Indian law (e.g., financial transaction records).
          </Text>

          <Text style={styles.sectionTitle}>Account and Data Deletion</Text>
          <Text style={styles.paragraph}>
            You may request deletion of your Astro Date account and all associated data by contacting <Text style={styles.linkText}>hello@astrodate.in</Text>. All deletion requests will be processed within 30 days. Certain financial records may be retained as required by Indian tax and regulatory laws.
          </Text>

          <Text style={styles.sectionTitle}>Children&apos;s Privacy</Text>
          <Text style={styles.paragraph}>
            Astro Date is strictly intended for users aged 18 and above. We do not knowingly collect information from anyone under 18. If we discover a minor has registered on the platform, the account will be immediately suspended and all associated data deleted. If you believe a minor is using the App, please contact <Text style={styles.linkText}>hello@astrodate.in</Text> immediately.
          </Text>

          <Text style={styles.sectionTitle}>Security</Text>
          <Text style={styles.paragraph}>
            We implement physical, electronic, and procedural safeguards to protect your information. Sensitive data including birth details and payment records are encrypted in storage and during transmission. However, no method of transmission over the internet is 100% secure and we cannot guarantee absolute security.
          </Text>

          <Text style={styles.sectionTitle}>Your Rights</Text>
          <Text style={styles.paragraph}>You have the right to:</Text>
          <Text style={styles.bullet}>• Access the personal data we hold about you</Text>
          <Text style={styles.bullet}>• Request correction of inaccurate data</Text>
          <Text style={styles.bullet}>• Request deletion of your account and data</Text>
          <Text style={styles.paragraph}>
            To exercise any of these rights, contact <Text style={styles.linkText}>hello@astrodate.in</Text>.
          </Text>

          <Text style={styles.sectionTitle}>Compliance with Indian Law</Text>
          <Text style={styles.paragraph}>
            This App and its data practices comply with the Information Technology Act, 2000, the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and all other applicable Indian data protection regulations.
          </Text>

          <Text style={styles.sectionTitle}>Changes to This Privacy Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. Changes will be notified through the App or by email. Continued use of the App after changes take effect constitutes acceptance of the revised policy.
          </Text>

          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            AstroDate Private Limited{"\n"}
            Email: <Text style={styles.linkText}>hello@astrodate.in</Text>
          </Text>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  container: { flex: 1, paddingHorizontal: 20 },

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
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
    borderColor: '#FFFFFF',
  },

  title: {
    fontFamily: SERIF,
    color: '#FFFFFF',
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 4,
  },
  lastUpdated: {
    color: '#9A93B5',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },

  card: {
    flex: 1,
    backgroundColor: 'rgba(13, 9, 32, 0.72)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  sectionTitle: {
    fontFamily: SERIF,
    color: '#B57BFF',
    fontSize: 18,
    marginTop: 22,
    marginBottom: 8,
    fontWeight: 'normal',
  },
  subSubTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    color: '#C9C3DE',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  bullet: {
    color: '#C9C3DE',
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 10,
    marginBottom: 6,
  },
  linkText: {
    color: '#A855F7',
    fontWeight: '600',
  },
});
