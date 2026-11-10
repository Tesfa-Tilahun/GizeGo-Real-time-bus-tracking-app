import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors.js";
import { useLocale } from "../context/LocaleContext.js";

export function AppHeader({ title, onMenuPress, search, onSearchChange }) {
  const { t, locale, setLocale } = useLocale();
  const resolvedTitle = title ?? t("brand.gizeGo");
  const [langOpen, setLangOpen] = useState(false);

  const pick = async (next) => {
    await setLocale(next);
    setLangOpen(false);
  };

  return (
    <LinearGradient colors={[colors.headerStart, colors.headerEnd]} style={styles.gradient}>
      <View style={styles.row}>
        <Pressable onPress={onMenuPress} style={styles.menuBtn} hitSlop={12}>
          <View style={styles.bar} />
          <View style={styles.bar} />
          <View style={styles.bar} />
        </Pressable>
        {search !== undefined ? (
          <TextInput
            style={styles.search}
            placeholder={t("header.search")}
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={search}
            onChangeText={onSearchChange}
            returnKeyType="search"
          />
        ) : (
          <Text style={styles.title}>{resolvedTitle}</Text>
        )}
        <Pressable
          onPress={() => setLangOpen(true)}
          style={styles.langCircle}
          hitSlop={10}
          accessibilityLabel={t("language.label")}
        >
          <Text style={styles.langCircleText} numberOfLines={1}>
            {locale === "am" ? t("lang.amShort") : t("lang.en")}
          </Text>
        </Pressable>
      </View>
      {search !== undefined ? <Text style={styles.subTitle}>{resolvedTitle}</Text> : null}

      <Modal
        visible={langOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangOpen(false)}
      >
        <Pressable style={styles.langModalBackdrop} onPress={() => setLangOpen(false)}>
          <Pressable style={styles.langModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.langModalTitle}>{t("language.label")}</Text>
            <Pressable
              style={[styles.langOption, locale === "en" && styles.langOptionActive]}
              onPress={() => void pick("en")}
            >
              <Text style={[styles.langOptionText, locale === "en" && styles.langOptionTextActive]}>
                English
              </Text>
              {locale === "en" ? <Text style={styles.langCheck}>✓</Text> : null}
            </Pressable>
            <Pressable
              style={[styles.langOption, locale === "am" && styles.langOptionActive]}
              onPress={() => void pick("am")}
            >
              <Text style={[styles.langOptionText, locale === "am" && styles.langOptionTextActive]}>
                አማርኛ
              </Text>
              {locale === "am" ? <Text style={styles.langCheck}>✓</Text> : null}
            </Pressable>
            <Pressable style={styles.langCancel} onPress={() => setLangOpen(false)}>
              <Text style={styles.langCancelText}>{t("language.close")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  gradient: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuBtn: {
    width: 40,
    paddingVertical: 8,
  },
  bar: {
    height: 3,
    width: 22,
    backgroundColor: colors.white,
    marginVertical: 2,
    borderRadius: 1,
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  subTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  search: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
  },
  langCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  langCircleText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  langModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  langModalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  langModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textDark,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
  },
  langOptionActive: {
    backgroundColor: "rgba(61, 126, 166, 0.12)",
  },
  langOptionText: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textDark,
  },
  langOptionTextActive: {
    color: colors.accentBlue,
  },
  langCheck: {
    fontSize: 18,
    color: colors.accentBlue,
    fontWeight: "700",
  },
  langCancel: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: "center",
  },
  langCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
