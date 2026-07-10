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

export default function TermsScreen() {
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
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.lastUpdated}>Effective June 29, 2026</Text>

        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Introduction</Text>
          <Text style={styles.paragraph}>
            By downloading, installing, or using the Astro Date App, you (&quot;User&quot;) agree to be bound by these Terms and Conditions (&quot;Terms&quot;). If you do not agree, do not use the App. These Terms form a legally binding agreement between you and AstroDate Private Limited.
          </Text>

          <Text style={styles.sectionTitle}>Eligibility</Text>
          <Text style={styles.paragraph}>To use Astro Date, you must:</Text>
          <Text style={styles.bullet}>• Be at least 18 years of age</Text>
          <Text style={styles.bullet}>• Be legally capable of entering into a binding agreement under Indian law</Text>
          <Text style={styles.bullet}>• Not be prohibited from using the App under any applicable law</Text>
          <Text style={styles.bullet}>• Provide accurate and truthful information during registration</Text>

          <Text style={styles.sectionTitle}>Account Registration</Text>
          <Text style={styles.paragraph}>When registering, you agree to:</Text>
          <Text style={styles.bullet}>• Provide your real name, accurate date, time, and place of birth, and a genuine profile photograph</Text>
          <Text style={styles.bullet}>• Keep your login credentials confidential and not share your account with anyone</Text>
          <Text style={styles.bullet}>• Notify us immediately at <Text style={styles.linkText}>hello@astrodate.in</Text> if you suspect unauthorized access to your account</Text>
          <Text style={styles.bullet}>• Maintain accurate and up-to-date profile information at all times</Text>
          <Text style={styles.paragraph}>
            AstroDate Private Limited reserves the right to suspend or terminate accounts with false, misleading, or incomplete information.
          </Text>

          <Text style={styles.sectionTitle}>How Astro Date Works</Text>
          <Text style={styles.paragraph}>
            Astro Date uses your birth details to generate an astrological birth chart and calculate compatibility scores between users. These scores are used to suggest potential matches. The compatibility score is an algorithmically generated output based on astrological principles and is provided for entertainment and guidance purposes only. It does not constitute a guarantee of relationship compatibility, success, or outcome.
          </Text>

          <Text style={styles.sectionTitle}>User Conduct</Text>
          <Text style={styles.paragraph}>You agree to:</Text>
          <Text style={styles.bullet}>• Use the App only for its intended purpose — meeting and connecting with potential partners</Text>
          <Text style={styles.bullet}>• Interact with other users respectfully and in good faith</Text>
          <Text style={styles.bullet}>• Report any suspicious, abusive, or inappropriate behaviour to <Text style={styles.linkText}>hello@astrodate.in</Text></Text>
          
          <Text style={styles.paragraph}>You must not:</Text>
          <Text style={styles.bullet}>• Create fake, impersonated, or misleading profiles</Text>
          <Text style={styles.bullet}>• Upload photos or content that you do not own or that violate others&apos; rights</Text>
          <Text style={styles.bullet}>• Harass, threaten, stalk, or abuse any other user</Text>
          <Text style={styles.bullet}>• Send unsolicited sexual content or explicit messages to other users</Text>
          <Text style={styles.bullet}>• Use the App for commercial solicitation, spam, or advertising</Text>
          <Text style={styles.bullet}>• Attempt to extract personal contact details from other users through deceptive means</Text>
          <Text style={styles.bullet}>• Use automated tools, bots, or scripts to access or scrape the App</Text>
          <Text style={styles.bullet}>• Attempt to hack, reverse-engineer, or disrupt the App or its servers</Text>
          <Text style={styles.paragraph}>
            Violation of these rules may result in immediate account suspension or termination.
          </Text>

          <Text style={styles.sectionTitle}>Profile Photos and Content</Text>
          <Text style={styles.paragraph}>
            You retain ownership of photos and content you upload. By uploading content, you grant AstroDate Private Limited non-exclusive, royalty-free license to display and use your content within the App for the purpose of operating the platform.
          </Text>
          <Text style={styles.paragraph}>You confirm that all content you upload:</Text>
          <Text style={styles.bullet}>• Is genuinely yours or you have the right to use it</Text>
          <Text style={styles.bullet}>• Does not contain nudity, graphic violence, hate speech, or illegal content</Text>
          <Text style={styles.bullet}>• Does not infringe any third-party intellectual property rights</Text>
          <Text style={styles.paragraph}>
            AstroDate Private Limited reserves the right to remove any content that violates these Terms without prior notice.
          </Text>

          <Text style={styles.sectionTitle}>Subscriptions and Premium Plans</Text>
          <Text style={styles.paragraph}>
            Astro Date currently offers core features free of charge. Subscription plans and premium features are planned for a future update and are not yet available in the App.
          </Text>
          <Text style={styles.paragraph}>
            When premium features are introduced, this section will be updated to include full details on pricing, billing, auto-renewal, and refund policies. Users will be notified of any such changes through the App or by email before they take effect.
          </Text>

          <Text style={styles.sectionTitle}>Compatibility Scores — Disclaimer</Text>
          <Text style={styles.paragraph}>
            The astrological compatibility scores and birth chart readings provided on Astro Date are powered by astrological data and calculations sourced from the Astrology API provided by astrology.com, a third-party service provider.
          </Text>
          <Text style={styles.paragraph}>
            These scores and readings are based on established astrological traditions and are intended for entertainment and personal guidance purposes only. AstroDate Private Limited makes no representations or warranties regarding the accuracy, reliability, or predictive value of any compatibility score or astrological reading generated through this API.
          </Text>
          <Text style={styles.paragraph}>
            The results are dependent on the data and algorithms provided by astrology.com, and Astro Date Pvt Ltd is not responsible for any errors, inaccuracies, or changes in the output of the third-party API.
          </Text>
          <Text style={styles.paragraph}>
            Users should exercise their own judgment in all personal and relationship decisions. Astro Date&apos;s compatibility scores should not be relied upon as a substitute for professional advice of any kind.
          </Text>

          <Text style={styles.sectionTitle}>Safety and Interactions with Other Users</Text>
          <Text style={styles.paragraph}>
            Astro Date facilitates connections between users but is not responsible for the conduct of any user outside the App. When meeting someone in person, we strongly recommend:
          </Text>
          <Text style={styles.bullet}>• Meeting in a public place for initial meetings</Text>
          <Text style={styles.bullet}>• Informing a trusted friend or family member of your plans</Text>
          <Text style={styles.bullet}>• Trusting your instincts — if something feels wrong, remove yourself from the situation</Text>
          <Text style={styles.paragraph}>
            AstroDate Private Limited is not liable for any harm, loss, or damage arising from interactions between users on or off the platform.
          </Text>

          <Text style={styles.sectionTitle}>Privacy</Text>
          <Text style={styles.paragraph}>
            Your use of the App is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the App, you also consent to the data practices described in our Privacy Policy.
          </Text>

          <Text style={styles.sectionTitle}>Intellectual Property</Text>
          <Text style={styles.paragraph}>
            All content, designs, trademarks, logos, algorithms, and software in the Astro Date App are the intellectual property of AstroDate Private Limited or its licensors. You are granted a limited, non-exclusive, non-transferable, revocable license to use the App for personal, non-commercial use only.
          </Text>
          <Text style={styles.paragraph}>
            You must not copy, modify, distribute, reverse-engineer, or create derivative works from any part of the App.
          </Text>

          <Text style={styles.sectionTitle}>Account Suspension and Termination</Text>
          <Text style={styles.subSubTitle}>By AstroDate Private Limited</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate your account without prior notice if you violate these Terms, engage in abusive or illegal conduct, submit false information, or if your account poses a risk to other users or the platform.
          </Text>
          <Text style={styles.subSubTitle}>By You</Text>
          <Text style={styles.paragraph}>
            You may delete your account at any time through the App settings or by contacting <Text style={styles.linkText}>hello@astrodate.in</Text>. Deletion requests are processed within 30 days.
          </Text>
          <Text style={styles.subSubTitle}>Effect of Termination</Text>
          <Text style={styles.paragraph}>
            Upon termination, your license to use the App ends immediately. Any unused subscription balance is non-refundable unless otherwise required by law.
          </Text>

          <Text style={styles.sectionTitle}>Limitation of Liability</Text>
          <Text style={styles.paragraph}>To the fullest extent permitted by Indian law:</Text>
          <Text style={styles.bullet}>• AstroDate Private Limited is not liable for any indirect, incidental, or consequential damages arising from your use of the App</Text>
          <Text style={styles.bullet}>• AstroDate Private Limited is not responsible for the conduct, actions, or statements of any user on or off the platform</Text>
          <Text style={styles.bullet}>• AstroDate Private Limited total liability to you shall not exceed the total amount paid by you to the platform in the 3 months preceding any claim</Text>
          <Text style={styles.bullet}>• The App is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis with no warranties of uninterrupted availability or error-free operation</Text>

          <Text style={styles.sectionTitle}>Indemnification</Text>
          <Text style={styles.paragraph}>
            You agree to indemnify and hold AstroDate Private Limited, its directors, employees, and agents harmless from any claim, loss, or expense (including legal fees) arising from your use of the App, your content, your interactions with other users, or your violation of these Terms.
          </Text>

          <Text style={styles.sectionTitle}>Governing Law and Dispute Resolution</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of India. Any disputes will first be addressed through good-faith negotiation. If unresolved within 30 days, disputes will be submitted to binding arbitration under the Arbitration and Conciliation Act, 1996, with the seat of arbitration in Chennai, Tamil Nadu, in the English language.
          </Text>

          <Text style={styles.sectionTitle}>Changes to These Terms</Text>
          <Text style={styles.paragraph}>
            AstroDate Private Limited may revise these Terms at any time. You will be notified of changes through the App or by email. Continued use of the App after the effective date of changes constitutes your acceptance.
          </Text>

          <Text style={styles.sectionTitle}>General Provisions</Text>
          <Text style={styles.bullet}>• Severability: If any clause is found invalid, remaining clauses remain in full effect</Text>
          <Text style={styles.bullet}>• Waiver: Failure to enforce any provision is not a waiver of that right</Text>
          <Text style={styles.bullet}>• Entire Agreement: These Terms and the Privacy Policy form the complete agreement between you and AstroDate Private Limited regarding the App</Text>

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
