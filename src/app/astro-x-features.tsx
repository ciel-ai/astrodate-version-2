import React, { useState } from 'react';
import {
  Pressable, StyleSheet, Text, View,
  ScrollView, Dimensions, Platform, Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

const { width: SW } = Dimensions.get('window');

export default function AstroXFeaturesScreen() {
  const insets = useSafeAreaInsets();
  const [showCompatibility, setShowCompatibility] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [showAshtaModal, setShowAshtaModal] = useState(false);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.menuBtn}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Discover</Text>
            <Text style={styles.headerSubtitle}>AI match insights for you 💜</Text>
          </View>
        </View>
        <LinearGradient
          colors={['#D97706', '#F59E0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumBadge}
        >
          <Text style={styles.premiumText}>👑 AstroX</Text>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── CARD 1: Astro Match Top Banner ── */}
        <Pressable onPress={() => setShowCompatibility(true)}>
          <View style={styles.bannerCard}>
            <Image
              source={require('@/assets/images/insights-bg.jpg')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {/* Darken the right side so text pops */}
            <View style={styles.bannerOverlay} />

            {/* Live feed pill — top left */}
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>⚡ Switch to Live Feed</Text>
            </View>

            {/* Content: left visual + right text, vertically centered */}
            <View style={styles.bannerContent}>
              {/* Left — golden orbit rings + sparkle star */}
              <View style={styles.bannerLeft}>
                {/* Outermost ring */}
                <View style={styles.orbitOuter}>
                  {/* Middle ring */}
                  <View style={styles.orbitMiddle}>
                    {/* Inner ring */}
                    <View style={styles.orbitInner}>
                      {/* Glowing star core */}
                      <View style={styles.orbitCore}>
                        <Text style={styles.orbitStar}>✦</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Right — text */}
              <View style={styles.bannerRight}>
                <Text style={styles.bannerSmall}>Exceptional match across</Text>
                <Text style={styles.bannerBig}>
                  <Text style={styles.tWestern}>Western</Text>
                  <Text style={styles.bannerBig}>, </Text>
                  <Text style={styles.tVedic}>Vedic</Text>
                  <Text style={styles.bannerBig}> & {`\n`}</Text>
                  <Text style={styles.tPersonality}>Personality</Text>
                  <Text style={styles.bannerBig}> astrology.</Text>
                </Text>

                {/* Badges row */}
                <View style={styles.bannerBadgeRow}>
                  <View style={styles.bannerBadge}>
                    <Text style={styles.bannerBadgeText}>🎯 Accurate</Text>
                  </View>
                  <View style={styles.bannerBadge}>
                    <Text style={styles.bannerBadgeText}>💡 Insightful</Text>
                  </View>
                  <View style={styles.bannerBadge}>
                    <Text style={styles.bannerBadgeText}>⚡ Powerful</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Pressable>

        {/* ── CARD 2: Why You Matched (full width, image + list) ── */}
        <LinearGradient
          colors={['rgba(50,20,80,0.7)', 'rgba(15,10,30,0.95)']}
          style={styles.fullCard}
        >
          <View style={styles.splitRow}>
            {/* Left — 3D heart image */}
            <View style={styles.cardImageBox}>
              <Text style={styles.bigEmoji}>💜</Text>
            </View>

            {/* Right — content */}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>✨ Why you matched</Text>
              {['You both love travelling',
                'Both enjoy movies and coffee',
                'Looking for a long-term relationship',
                'Similar communication style',
                'High emotional compatibility',
              ].map((item, i) => (
                <View key={i} style={styles.checkRow}>
                  <View style={styles.checkBubble}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                  <Text style={styles.checkText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Chevron */}
            <Text style={styles.chevron}>›</Text>
          </View>
        </LinearGradient>

        {/* ── HORIZONTAL SCROLL: Ashtakoota, Indian Astrology, Personality Score ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bottomScroll}
        >

          {/* Ashtakoota */}
          <LinearGradient
            colors={['rgba(18,8,45,0.98)', 'rgba(10,5,25,0.99)']}
            style={[styles.smallCard, { justifyContent: 'space-between' }]}
          >
            <View>
              <Text style={styles.smallCardTitle}>⚡ Ashtakoota (36/36)</Text>

              {/* Ring + Score row */}
              <View style={styles.ashtaMainRow}>
                {/* Glowing double ring */}
                <View style={styles.ashtaRingOuter}>
                  <View style={styles.ashtaBigRing}>
                    <Text style={styles.ashtaBigScore}>28 / 36</Text>
                    <Text style={styles.ashtaBigLabel}>Excellent{`\n`}Match</Text>
                  </View>
                </View>

                {/* Score box */}
                <View style={styles.ashtaHexWrap}>
                  <LinearGradient
                    colors={['rgba(50,20,100,0.95)', 'rgba(25,8,60,0.99)']}
                    style={styles.ashtaHex}
                  >
                    <Text style={styles.ashtaHexNum}>9</Text>
                  </LinearGradient>
                  <Text style={styles.ashtaHexLabel}>Score</Text>
                </View>
              </View>
            </View>

            {/* Full-width button — pinned to bottom */}
            <Pressable
              style={styles.cardFullBtn}
              onPress={() => setShowAshtaModal(true)}
            >
              <Text style={styles.cardFullBtnText}>View full Ashtakoota  →</Text>
            </Pressable>
          </LinearGradient>

          {/* Indian Astrology */}
          <LinearGradient
            colors={['rgba(18,8,45,0.98)', 'rgba(10,5,25,0.99)']}
            style={styles.smallCard}
          >
            <Text style={styles.smallCardTitle}>🔰 Indian Astrology</Text>

            {/* Centered OM emoji — no background circle */}
            <View style={styles.omMandalaWrap}>
              <Text style={styles.omMandalaEmoji}>🕉️</Text>
            </View>

            {/* Manglik warning */}
            <Text style={styles.manglikBold}>⚠️  Manglik (Mild)</Text>

            {/* Dosha rows */}
            <View style={styles.doshaRowFull}>
              <Text style={styles.doshaTextFull}>Nadi Dosha</Text>
              <View style={styles.greenDot}><Text style={styles.greenTick}>✓</Text></View>
            </View>
            <View style={styles.doshaRowFull}>
              <Text style={styles.doshaTextFull}>Bhakoot Dosha</Text>
              <View style={styles.greenDot}><Text style={styles.greenTick}>✓</Text></View>
            </View>

            {/* Full-width button */}
            <Pressable style={[styles.cardFullBtn, { marginTop: 10 }]}>
              <Text style={styles.cardFullBtnText}>View full report  →</Text>
            </Pressable>
          </LinearGradient>

          {/* Personality Score */}
          <LinearGradient
            colors={['rgba(30,15,60,0.8)', 'rgba(15,10,30,0.95)']}
            style={styles.smallCard}
          >
            <Text style={styles.smallCardTitle}>🧠 Personality Score</Text>
            <View style={styles.personalityRing}>
              <Text style={styles.personalityPct}>74%</Text>
            </View>
            <Text style={styles.personalityDesc}>Good compatibility{'\n'}based on your{'\n'}personality.</Text>
            <Pressable style={styles.viewFullBtn}>
              <Text style={styles.viewFullText}>View personality details  →</Text>
            </Pressable>
          </LinearGradient>

        </ScrollView>

        {/* ── CARD 3: Synastry Badges ── */}
        <LinearGradient
          colors={['rgba(20,10,50,0.85)', 'rgba(10,5,25,0.95)']}
          style={styles.fullCard}
        >
          <View style={styles.synastryRow}>
            {/* Left: Shield visual */}
            <View style={styles.shieldContainer}>
              {/* Shield Shape */}
              <LinearGradient
                colors={['#6D28D9', '#1E1B4B']}
                style={styles.shieldShape}
              >
                {/* Inner border line for shield depth */}
                <View style={styles.shieldInner}>
                  <Text style={styles.shieldStar}>✦</Text>
                </View>
              </LinearGradient>
              {/* Orbit Ring with sparkling dot */}
              <View style={styles.shieldOrbit}>
                <View style={styles.orbitGlowDot} />
              </View>
            </View>

            {/* Right: Content */}
            <View style={styles.synastryRightStacked}>
              <View>
                <Text style={styles.synastryTitleText} numberOfLines={1}>✨ Synastry Badges</Text>
                <Text style={styles.synastrySubText} numberOfLines={1}>Special cosmic connections</Text>
              </View>

              <Pressable
                style={styles.synastryBtnAlignRight}
                onPress={() => setShowBadgesModal(true)}
              >
                <Text style={styles.synastryBtnText}>View all badges  →</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        {/* ── CARD 4: Shared Interests (full width) ── */}
        <LinearGradient
          colors={['rgba(30,15,60,0.7)', 'rgba(15,10,30,0.95)']}
          style={styles.fullCard}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>💜 Shared Interests</Text>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </View>
          <Text style={styles.interestSub}>5 Things you both like</Text>

          <View style={styles.interestRow}>
            {[
              { emoji: '🍿', label: 'Movies' },
              { emoji: '✈️', label: 'Travel' },
              { emoji: '☕', label: 'Coffee' },
              { emoji: '📈', label: 'Investing' },
              { emoji: '🐾', label: 'Dogs' },
            ].map((item, i) => (
              <View key={i} style={styles.interestItem}>
                <Text style={styles.interestEmoji}>{item.emoji}</Text>
                <Text style={styles.interestLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

      </ScrollView>

      {/* ── COSMIC COMPATIBILITY MODAL ── */}
      <Modal
        visible={showCompatibility}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCompatibility(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCompatibility(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>

            {/* Handle bar */}
            <View style={styles.modalHandle} />

            {/* Title row */}
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>⚡ Cosmic Compatibility</Text>
              <Text style={styles.modalInfoIcon}>ⓘ</Text>
            </View>

            {/* 3 rings */}
            <View style={styles.ringsRow}>
              {/* Western Astrology — Purple */}
              <View style={styles.ringItem}>
                <View style={[styles.ringCircle, { borderColor: '#8B5CF6' }]}>
                  <Text style={styles.ringPct}>92%</Text>
                </View>
                <Text style={styles.ringLabel}>Western{`\n`}Astrology</Text>
                <Text style={[styles.ringWeight, { color: '#8B5CF6' }]}>(45%)</Text>
              </View>

              {/* Vedic Astrology — Cyan */}
              <View style={styles.ringItem}>
                <View style={[styles.ringCircle, { borderColor: '#06B6D4' }]}>
                  <Text style={styles.ringPct}>78%</Text>
                </View>
                <Text style={styles.ringLabel}>Vedic{`\n`}Astrology</Text>
                <Text style={[styles.ringWeight, { color: '#06B6D4' }]}>(45%)</Text>
              </View>

              {/* Personality — Pink */}
              <View style={styles.ringItem}>
                <View style={[styles.ringCircle, { borderColor: '#EC4899' }]}>
                  <Text style={styles.ringPct}>74%</Text>
                </View>
                <Text style={styles.ringLabel}>Personality{`\n`}Match</Text>
                <Text style={[styles.ringWeight, { color: '#EC4899' }]}>(10%)</Text>
              </View>
            </View>

            {/* Total Score footer */}
            <LinearGradient
              colors={['rgba(30,15,60,0.6)', 'rgba(15,8,30,0.8)']}
              style={styles.totalScoreRow}
            >
              <Text style={styles.totalScoreLabel}>Total Compatibility Score</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.totalScoreNum}>81</Text>
                <Text style={styles.totalScoreDen}> /100</Text>
              </View>
            </LinearGradient>

          </Pressable>
        </Pressable>
      </Modal>

      {/* ── SYNASTRY BADGES MODAL ── */}
      <Modal
        visible={showBadgesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBadgesModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowBadgesModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>

            {/* Handle bar */}
            <View style={styles.modalHandle} />

            {/* Title row */}
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>✨ Synastry Badges</Text>
            </View>

            {/* Badge pills wrap row */}
            <View style={styles.synastrybadgeRowModal}>

              {/* Harmonious Souls — dark pill, purple sparkle */}
              <View style={styles.synBadgeDark}>
                <Text style={styles.synBadgeIcon}>✦</Text>
                <Text style={styles.synBadgeDarkText}>Harmonious Souls</Text>
              </View>

              {/* Nadi Match — pink pill */}
              <LinearGradient
                colors={['#9B2060', '#C2185B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.synBadgePink}
              >
                <Text style={styles.synBadgeIcon}>💗</Text>
                <Text style={styles.synBadgeLightText}>Nadi Match</Text>
              </LinearGradient>

              {/* Gana Match — dark pill, gold star border */}
              <View style={styles.synBadgeGold}>
                <Text style={styles.synBadgeGoldIcon}>⭐</Text>
                <Text style={styles.synBadgeGoldText}>Gana Match</Text>
              </View>

            </View>

          </Pressable>
        </Pressable>
      </Modal>

      {/* ── ASHTAKOOTA BREAKDOWN MODAL ── */}
      <Modal
        visible={showAshtaModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAshtaModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAshtaModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>

            {/* Handle bar */}
            <View style={styles.modalHandle} />

            {/* Title row */}
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>⚡ Ashtakoota Breakdown <Text style={{ color: '#A78BFA', fontSize: 14 }}>(36/36)</Text></Text>
              <Text style={styles.modalInfoIcon}>ⓘ</Text>
            </View>

            {/* Grid of 8 parameters */}
            <View style={styles.ashtaGrid}>
              
              {/* Row 1 */}
              <View style={styles.ashtaGridRow}>
                {/* Varna */}
                <View style={styles.ashtaGridItem}>
                  <Text style={styles.ashtaItemName}>Varna</Text>
                  <Text style={styles.ashtaItemEmoji}>⚖️</Text>
                  <Text style={styles.ashtaStars}>★★★★★</Text>
                </View>

                {/* Vashya */}
                <View style={styles.ashtaGridItem}>
                  <Text style={styles.ashtaItemName}>Vashya</Text>
                  <Text style={styles.ashtaItemEmoji}>🪄</Text>
                  <Text style={styles.ashtaStars}>★★★½☆</Text>
                </View>

                {/* Tara */}
                <View style={styles.ashtaGridItem}>
                  <Text style={styles.ashtaItemName}>Tara</Text>
                  <Text style={styles.ashtaItemEmoji}>☀️</Text>
                  <Text style={styles.ashtaStars}>★★★★★</Text>
                </View>

                {/* Yoni */}
                <View style={styles.ashtaGridItemLast}>
                  <Text style={styles.ashtaItemName}>Yoni</Text>
                  <Text style={styles.ashtaItemEmoji}>🐆</Text>
                  <Text style={styles.ashtaStars}>★★★★½</Text>
                </View>
              </View>

              {/* Border Divider line */}
              <View style={styles.ashtaGridDivider} />

              {/* Row 2 */}
              <View style={styles.ashtaGridRow}>
                {/* Graha Maitri */}
                <View style={styles.ashtaGridItem}>
                  <Text style={styles.ashtaItemName}>Graha Maitri</Text>
                  <Text style={styles.ashtaItemEmoji}>🤝</Text>
                  <Text style={styles.ashtaStars}>★★★★★</Text>
                </View>

                {/* Gana */}
                <View style={styles.ashtaGridItem}>
                  <Text style={styles.ashtaItemName}>Gana</Text>
                  <Text style={styles.ashtaItemEmoji}>🧜</Text>
                  <Text style={styles.ashtaStars}>★★★½☆</Text>
                </View>

                {/* Bhakoot */}
                <View style={styles.ashtaGridItem}>
                  <Text style={styles.ashtaItemName}>Bhakoot</Text>
                  <Text style={styles.ashtaItemEmoji}>🔄</Text>
                  <Text style={styles.ashtaStars}>★★★★☆</Text>
                </View>

                {/* Nadi */}
                <View style={styles.ashtaGridItemLast}>
                  <Text style={styles.ashtaItemName}>Nadi</Text>
                  <Text style={styles.ashtaItemEmoji}>🧬</Text>
                  <Text style={styles.ashtaStars}>★★★★★</Text>
                </View>
              </View>

            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08040F',
  },

  // ── Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F0820',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalInfoIcon: { color: 'rgba(255,255,255,0.4)', fontSize: 18 },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  ringItem: { alignItems: 'center', gap: 8 },
  ringCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ringPct: { color: '#fff', fontSize: 20, fontWeight: '900' },
  ringLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  ringWeight: { fontSize: 12, fontWeight: '800' },
  totalScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  totalScoreLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' },
  totalScoreNum: { color: '#EC4899', fontSize: 32, fontWeight: '900' },
  totalScoreDen: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { color: '#fff', fontSize: 18 },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 1,
  },
  premiumBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
  },
  premiumText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 14,
    paddingBottom: 80,
    gap: 12,
  },

  // ── Banner Card
  bannerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 192,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5,2,12,0.38)',
  },
  livePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(88,28,160,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 10,
  },
  livePillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 36,
    paddingBottom: 10,
  },
  bannerLeft: {
    width: SW * 0.34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 3-ring orbit — golden/amber tones
  orbitOuter: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitMiddle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitCore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,220,0.12)',
    shadowColor: '#FDE68A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  orbitStar: { color: '#FDE68A', fontSize: 20, fontWeight: '900' },
  bannerRight: { flex: 1, paddingLeft: 6 },
  bannerSmall: { color: 'rgba(255,255,255,0.70)', fontSize: 10.5, marginBottom: 2, letterSpacing: 0.2 },
  bannerBig: { color: '#fff', fontSize: 16.5, fontWeight: '800', lineHeight: 22 },
  tWestern: { color: '#C084FC', fontWeight: '800', fontSize: 16.5 },
  tVedic: { color: '#F472B6', fontWeight: '800', fontSize: 16.5 },
  tPersonality: { color: '#FBBF24', fontWeight: '800', fontSize: 16.5 },
  bannerBadgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  bannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bannerBadgeText: { color: 'rgba(255,255,255,0.88)', fontSize: 9, fontWeight: '700' },

  // Full-width cards
  fullCard: {
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardImageBox: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigEmoji: { fontSize: 48 },
  cardContent: { flex: 1 },
  cardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoIcon: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  chevron: { color: 'rgba(255,255,255,0.4)', fontSize: 24, marginLeft: 4 },

  // Checklist
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 3,
  },
  checkBubble: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 9, fontWeight: '900' },
  checkText: { color: '#D8D0EE', fontSize: 11, fontWeight: '500', flex: 1, lineHeight: 15 },

  // Synastry (Redesigned with Shield)
  synastryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  shieldContainer: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  shieldShape: {
    width: 64,
    height: 74,
    borderRadius: 14,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderWidth: 1.8,
    borderColor: 'rgba(167, 139, 250, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  shieldInner: {
    width: '88%',
    height: '88%',
    borderRadius: 12,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldStar: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: '900',
    textShadowColor: '#C4B5FD',
    textShadowRadius: 8,
  },
  shieldOrbit: {
    position: 'absolute',
    width: 108,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 114, 182, 0.5)',
    transform: [{ rotate: '-22deg' }],
    justifyContent: 'center',
  },
  orbitGlowDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFF',
    left: 12,
    bottom: 3,
    shadowColor: '#F472B6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  synastryRightStacked: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: 88,
    paddingLeft: 12,
  },
  synastryTitleText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  synastrySubText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12.5,
  },
  synastryBtnAlignRight: {
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    alignSelf: 'flex-start',
  },
  synastryBtnText: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '700',
  },

  // Modal Badge styles
  synastrybadgeRowModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  synBadgeDark: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synBadgeIcon: {
    color: '#60A5FA',
    fontSize: 13,
  },
  synBadgeDarkText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  synBadgePink: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synBadgeLightText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  synBadgeGold: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synBadgeGoldIcon: {
    fontSize: 13,
  },
  synBadgeGoldText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },

  // Shared Interests
  interestSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 10 },
  interestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  interestItem: { alignItems: 'center', gap: 5 },
  interestEmoji: { fontSize: 34 },
  interestLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },

  // Bottom scroll
  bottomScroll: {
    paddingRight: 14,
    gap: 10,
  },
  smallCard: {
    width: SW * 0.48,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  smallCardTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 12,
  },

  // ── Ashtakoota (redesigned)
  ashtaMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 12,
  },
  // Glowing outer halo
  ashtaRingOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.04)',
  },
  ashtaBigRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124,58,237,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  ashtaBigScore: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  ashtaBigLabel: { color: '#C4B5FD', fontSize: 8, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  ashtaHexWrap: { alignItems: 'center', gap: 5 },
  ashtaHex: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ashtaHexNum: { color: '#A78BFA', fontSize: 24, fontWeight: '900' },
  ashtaHexLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' },

  // Shared full-width card button
  cardFullBtn: {
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  cardFullBtnText: { color: '#C4B5FD', fontSize: 11, fontWeight: '700' },

  // ── Indian Astrology (redesigned)
  omMandalaWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  omMandalaCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,120,40,0.35)',
  },
  omMandalaEmoji: { fontSize: 42 },
  manglikBold: { color: '#F59E0B', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  doshaRowFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  doshaTextFull: { color: '#D8D0EE', fontSize: 11, fontWeight: '600' },
  greenDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenTick: { color: '#fff', fontSize: 10, fontWeight: '900' },

  // Keep old references (used by Personality Score card)
  doshaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  doshaText: { color: '#D8D0EE', fontSize: 10, fontWeight: '600' },
  manglik: { color: '#F59E0B', fontSize: 10.5, fontWeight: '800', marginBottom: 4 },
  omRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  omCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  omText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  viewFullBtn: { marginTop: 4 },
  viewFullText: { color: '#A78BFA', fontSize: 9.5, fontWeight: '600' },

  // Personality Score
  personalityRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 8,
    backgroundColor: 'rgba(236,72,153,0.06)',
  },
  personalityPct: { color: '#fff', fontSize: 20, fontWeight: '900' },
  personalityDesc: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 8,
  },

  // Location
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationIcon: { fontSize: 24 },
  locationValue: { color: '#fff', fontSize: 13, fontWeight: '800' },
  locationLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 },

  // Ashtakoota Breakdown Grid styles
  ashtaGrid: {
    marginTop: 8,
    paddingBottom: 8,
  },
  ashtaGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  ashtaGridItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  ashtaGridItemLast: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  ashtaItemName: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  ashtaItemEmoji: {
    fontSize: 22,
  },
  ashtaStars: {
    color: '#FBBF24',
    fontSize: 9.5,
    fontWeight: '800',
  },
  ashtaGridDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
});
