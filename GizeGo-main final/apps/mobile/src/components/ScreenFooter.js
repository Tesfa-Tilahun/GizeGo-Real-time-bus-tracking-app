import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors.js";
import { useLocale } from "../context/LocaleContext.js";

export function SocialRow() {
  return (
    <View style={styles.socialRow}>
      {["f", "𝕏", "W", "in"].map((t, i) => (
        <View key={i} style={[styles.circle, i < 3 && styles.circleSpacing]}>
          <Text style={styles.circleText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export function ContactFooter() {
  const { t } = useLocale();
  return (
    <LinearGradient colors={[colors.footerStart, colors.footerEnd]} style={styles.footer}>
      <View style={styles.footerInner}>
        <Text style={styles.footerIcon}>✉</Text>
        <Text style={styles.footerText}>
          {t("footer.contactPrefix")}+251 991 500 027
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 20,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.footerEnd,
    alignItems: "center",
    justifyContent: "center",
  },
  circleSpacing: {
    marginRight: 16,
  },
  circleText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  footer: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  footerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerIcon: {
    color: colors.white,
    fontSize: 18,
  },
  footerText: {
    color: colors.white,
    fontSize: 13,
    flex: 1,
    textAlign: "center",
  },
});
