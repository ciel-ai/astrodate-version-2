import { useEffect, useRef, useState } from 'react';
import './PrivacyPolicy.css';

/**
 * AstroDate — Privacy Policy page.
 *
 * Self-contained: only external dependency is the LibreBaskerville-Regular.ttf
 * font referenced from PrivacyPolicy.css (`/fonts/LibreBaskerville-Regular.ttf`
 * by default — update that path to wherever it lives in this site's public
 * assets, or swap the @font-face for however this project loads fonts).
 *
 * Route this at /privacy (or wherever) with your router of choice:
 *   <Route path="/privacy" element={<PrivacyPolicy />} />
 */

const SECTIONS: { id: string; title: string }[] = [
  { id: 'information-we-collect', title: 'Information We Collect' },
  { id: 'how-we-use', title: 'How We Use Your Information' },
  { id: 'birth-details', title: 'Birth Details and Astrological Data' },
  { id: 'photos-media', title: 'Profile Photos and Media' },
  { id: 'sharing', title: 'Sharing Your Information' },
  { id: 'third-party', title: 'Third-Party Services' },
  { id: 'retention', title: 'Data Retention' },
  { id: 'deletion', title: 'Account and Data Deletion' },
  { id: 'childrens-privacy', title: 'Children’s Privacy' },
  { id: 'security', title: 'Security' },
  { id: 'your-rights', title: 'Your Rights' },
  { id: 'compliance', title: 'Compliance with Indian Law' },
  { id: 'changes', title: 'Changes to This Privacy Policy' },
  { id: 'contact', title: 'Contact Us' },
];

function Mark() {
  return <span className="ap-mark" aria-hidden="true" />;
}

function TableOfContents({ current, variant }: { current: string; variant: 'desktop' | 'mobile' }) {
  const list = (
    <ol>
      {SECTIONS.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className={variant === 'desktop' && current === s.id ? 'ap-current' : undefined}>
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === 'mobile') {
    return (
      <details className="ap-toc-mobile">
        <summary>Contents</summary>
        {list}
      </details>
    );
  }

  return (
    <nav className="ap-toc ap-desktop" aria-label="Table of contents">
      <p className="ap-eyebrow">Contents</p>
      {list}
    </nav>
  );
}

export default function PrivacyPolicy() {
  const [currentSection, setCurrentSection] = useState<string>(SECTIONS[0].id);
  const docRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!docRef.current || typeof IntersectionObserver === 'undefined') return;

    const sections = Array.from(docRef.current.querySelectorAll<HTMLElement>('section.ap-block'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setCurrentSection(entry.target.id);
        });
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ap-privacy">
      <div className="ap-starfield" aria-hidden="true" />

      <header className="ap-topbar">
        <div className="ap-brand">
          <Mark />
          Astro Date <span className="ap-div">/ Privacy Policy</span>
        </div>
        <div className="ap-topbar-actions">
          <span>Effective June 29, 2026</span>
          <button className="ap-print-btn" onClick={() => window.print()} type="button">
            Print / Save PDF
          </button>
        </div>
      </header>

      <div className="ap-frame">
        <TableOfContents current={currentSection} variant="desktop" />

        <main className="ap-doc" ref={docRef}>
          <TableOfContents current={currentSection} variant="mobile" />

          <div className="ap-doc-head">
            <p className="ap-eyebrow">
              <Mark /> Legal
            </p>
            <h1>Privacy Policy</h1>
            <p className="ap-meta">
              <strong>Astro Date</strong> — operated by AstroDate Private Limited
            </p>
            <p className="ap-meta">Effective June 29, 2026</p>

            <div className="ap-lede">
              <p>
                This Privacy Policy applies to the Astro Date App operated by AstroDate Private Limited
                (&#8220;Company&#8221;, &#8220;we&#8221;, &#8220;us&#8221;, or &#8220;our&#8221;). Astro Date is a
                platform that combines astrology-based compatibility matching with a dating experience, helping
                users find meaningful connections through birth chart analysis and compatibility scores.
              </p>
              <p>By using the App, you agree to the collection and use of your information as described in this Privacy Policy.</p>
            </div>
          </div>

          <section className="ap-block" id="information-we-collect">
            <h2>
              <Mark /> Information We Collect
            </h2>

            <h3>Personal Information</h3>
            <p>When you register and use Astro Date, we collect:</p>
            <ul className="ap-list">
              <li>Full name, date of birth, time of birth, and place of birth (used for generating your birth chart and compatibility scores)</li>
              <li>Gender identity and relationship preferences</li>
              <li>Profile photographs and any additional media you upload</li>
              <li>Email address and/or mobile number</li>
              <li>A brief personal bio or description</li>
            </ul>

            <h3>Location Data</h3>
            <p>
              We collect your device&#8217;s location to show you potential matches nearby. Location is used only
              for match suggestions and is never shared publicly on your profile without your consent.
            </p>

            <h3>Controlling Your Location</h3>
            <p>
              You can enable or disable location sharing at any time from the Settings screen. When you disable
              location sharing, your stored location is deleted from our servers immediately and you will no
              longer appear with a distance label in other users&#8217; discovery feeds. Re-enabling location
              requires granting permission again through the OS prompt.
            </p>

            <h3>Usage Data</h3>
            <p>We automatically collect:</p>
            <ul className="ap-list">
              <li>Device type, operating system, and IP address</li>
              <li>Pages and features accessed within the App</li>
              <li>Time and duration of App sessions</li>
              <li>Interactions such as likes, matches, and messages</li>
            </ul>

            <h3>Communications</h3>
            <p>
              Any messages exchanged between matched users on the platform are stored temporarily to enable the
              chat feature. We may review flagged communications solely for safety and moderation purposes.
            </p>
          </section>

          <section className="ap-block" id="how-we-use">
            <h2>
              <Mark /> How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="ap-list">
              <li>Generate your Vedic or Western astrology birth chart</li>
              <li>Calculate compatibility scores between you and other users</li>
              <li>Suggest potential matches based on compatibility and location</li>
              <li>Enable profile display, messaging, and match interactions</li>
              <li>Send you notifications, updates, and relevant alerts</li>
              <li>Improve App performance and user experience through analytics</li>
              <li>Ensure platform safety by detecting fraud, abuse, or violations</li>
              <li>Comply with applicable legal obligations</li>
            </ul>
          </section>

          <section className="ap-block" id="birth-details">
            <h2>
              <Mark /> Birth Details and Astrological Data
            </h2>
            <p>
              Your date, time, and place of birth are sensitive personal details used exclusively to generate your
              astrological profile and compatibility scores. This data:
            </p>
            <ul className="ap-list">
              <li>Is encrypted in storage and transmission</li>
              <li>Is never sold to third parties</li>
              <li>
                Is not displayed publicly on your profile (only your astrological profile summary such as sun
                sign or compatibility score may be visible to other users, as per your settings)
              </li>
              <li>May be used in anonymized, aggregated form for platform analytics and compatibility algorithm improvements</li>
            </ul>
          </section>

          <section className="ap-block" id="photos-media">
            <h2>
              <Mark /> Profile Photos and Media
            </h2>
            <p>
              Profile photos are visible to other users on the platform as part of your dating profile. You retain
              ownership of all photos you upload. By uploading photos, you grant AstroDate Private Limited a
              limited, non-exclusive license to display them within the App for the purpose of operating the
              platform. We do not use your photos for advertising or share them with third parties.
            </p>
          </section>

          <section className="ap-block" id="sharing">
            <h2>
              <Mark /> Sharing Your Information
            </h2>
            <p>We do not sell your personal information. We may share your information only in the following circumstances:</p>
            <ul className="ap-list">
              <li>
                <strong>With other users:</strong> Your profile information (name, photos, astrological summary,
                bio) is visible to other users as part of normal platform operation
              </li>
              <li>
                <strong>With service providers:</strong> Trusted third-party providers who assist in operating the
                App (payment processors, analytics, cloud storage) and who are bound by confidentiality obligations
              </li>
              <li><strong>For legal compliance:</strong> When required by law, court order, or government authority</li>
              <li><strong>For safety:</strong> When we believe disclosure is necessary to prevent fraud, harm, or illegal activity</li>
              <li>
                <strong>In a business transfer:</strong> In the event of a merger, acquisition, or sale of assets,
                your data may be transferred with appropriate notice to you
              </li>
            </ul>
          </section>

          <section className="ap-block" id="third-party">
            <h2>
              <Mark /> Third-Party Services
            </h2>
            <p>The App uses the following third-party services, each governed by their own privacy policies:</p>
            <ul className="ap-list">
              <li>Google Play Services and Apple App Store Services</li>
              <li><strong>RevenueCat</strong> — processes and manages in-app subscription purchases made through the Apple App Store and Google Play Store</li>
              <li><strong>Google Gemini</strong> — automatically screens messages between matched users for harassment, spam, and other safety violations before they are delivered</li>
              <li><strong>AstrologyAPI.com</strong> — calculates birth charts, planetary positions, and compatibility scores from the birth date, time, and place you provide</li>
              <li><strong>Supabase</strong> — used for cloud storage, database, and backend hosting</li>
              <li>Analytics providers — to be confirmed in a future update</li>
            </ul>
            <p>
              Additional payment, analytics, or service providers may be introduced in future updates. This
              section will be updated accordingly when such changes are made, and users will be notified through
              the App or by email.
            </p>
          </section>

          <section className="ap-block" id="retention">
            <h2>
              <Mark /> Data Retention
            </h2>
            <p>
              We retain your personal data for as long as your account is active. If you delete your account,
              your personal data including birth details, photos, and messages will be deleted within 30 days,
              except where retention is required by applicable Indian law (e.g., financial transaction records).
            </p>
          </section>

          <section className="ap-block" id="deletion">
            <h2>
              <Mark /> Account and Data Deletion
            </h2>
            <p>
              You may request deletion of your Astro Date account and all associated data by contacting{' '}
              <a href="mailto:hello@astrodate.in">hello@astrodate.in</a>. All deletion requests will be processed
              within 30 days. Certain financial records may be retained as required by Indian tax and regulatory laws.
            </p>
          </section>

          <section className="ap-block" id="childrens-privacy">
            <h2>
              <Mark /> Children&#8217;s Privacy
            </h2>
            <p>
              Astro Date is strictly intended for users aged 18 and above. We do not knowingly collect information
              from anyone under 18. If we discover a minor has registered on the platform, the account will be
              immediately suspended and all associated data deleted. If you believe a minor is using the App,
              please contact <a href="mailto:hello@astrodate.in">hello@astrodate.in</a> immediately.
            </p>
          </section>

          <section className="ap-block" id="security">
            <h2>
              <Mark /> Security
            </h2>
            <p>
              We implement physical, electronic, and procedural safeguards to protect your information. Sensitive
              data including birth details and payment records are encrypted in storage and during transmission.
              However, no method of transmission over the internet is 100% secure and we cannot guarantee absolute
              security.
            </p>
          </section>

          <section className="ap-block" id="your-rights">
            <h2>
              <Mark /> Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="ap-list">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
            </ul>
            <p>
              To exercise any of these rights, contact <a href="mailto:hello@astrodate.in">hello@astrodate.in</a>.
            </p>
          </section>

          <section className="ap-block" id="compliance">
            <h2>
              <Mark /> Compliance with Indian Law
            </h2>
            <p>
              This App and its data practices comply with the Information Technology Act, 2000, the IT (Reasonable
              Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and all
              other applicable Indian data protection regulations.
            </p>
          </section>

          <section className="ap-block" id="changes">
            <h2>
              <Mark /> Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be notified through the App or by
              email. Continued use of the App after changes take effect constitutes acceptance of the revised policy.
            </p>
          </section>

          <section className="ap-block" id="contact">
            <h2>
              <Mark /> Contact Us
            </h2>
            <div className="ap-contact-card">
              <div className="ap-org">AstroDate Private Limited</div>
              <div>
                Email: <a href="mailto:hello@astrodate.in">hello@astrodate.in</a>
              </div>
            </div>
          </section>

          <footer className="ap-doc-footer">
            <span>&copy; 2026 AstroDate Private Limited. All rights reserved.</span>
            <a className="ap-back-to-top" href="#top">
              Back to top
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
