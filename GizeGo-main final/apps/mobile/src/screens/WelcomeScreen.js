import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { GradientButton } from "../components/GradientButton.js";
import { AppHeader } from "../components/AppHeader.js";
import { SideMenu } from "../components/SideMenu.js";
import { colors } from "../theme/colors.js";
import { useAuth } from "../context/AuthContext.js";
import { useLocale } from "../context/LocaleContext.js";

export function WelcomeScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const source = route.params?.source ?? "login";
  const isSignup = source === "signup";

  const firstName = (user?.name ?? t("welcome.traveler")).trim().split(/\s+/)[0];

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <AppHeader onMenuPress={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={[colors.headerStart, colors.headerEnd]} style={styles.hero}>
          <Text style={styles.heroTitle}>{isSignup ? t("welcome.aboard") : t("welcome.back")}</Text>
          <Text style={styles.heroName}>{firstName}!</Text>
          <Text style={styles.heroBody}>
            {isSignup ? t("welcome.bodySignup") : t("welcome.bodyLogin")}
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t("welcome.signedInAs")}</Text>
          <Text style={styles.cardValue}>{user?.name ?? "—"}</Text>
          {user?.email ? (
            <Text style={styles.cardMeta}>{user.email}</Text>
          ) : null}
          {user?.phone ? (
            <Text style={styles.cardMeta}>{user.phone}</Text>
          ) : null}
        </View>

        <GradientButton label={t("welcome.continueHome")} onPress={() => navigation.navigate("Home")} />
        <View style={styles.spacer} />
        <GradientButton label={t("welcome.openMap")} onPress={() => navigation.navigate("Map")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scroll: {
    paddingBottom: 32,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "800",
  },
  heroName: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 14,
    opacity: 0.9,
  },
  heroBody: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    marginHorizontal: 20,
    marginTop: -16,
    marginBottom: 24,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 18,
    color: colors.textDark,
    fontWeight: "700",
  },
  cardMeta: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  spacer: {
    height: 14,
  },
});
