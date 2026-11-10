import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppHeader } from "../components/AppHeader.js";
import { GradientButton } from "../components/GradientButton.js";
import { SideMenu } from "../components/SideMenu.js";
import { colors } from "../theme/colors.js";
import { requestForgotPassword } from "../api/gizegoApi.js";
import { useLocale } from "../context/LocaleContext.js";

export function ForgotPasswordScreen({ navigation }) {
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.includes("@")) {
      Alert.alert(t("forgot.invalidEmailTitle"), t("forgot.invalidEmail"));
      return;
    }
    setBusy(true);
    try {
      const data = await requestForgotPassword(email.trim());
      const devTok =
        typeof data?.devResetToken === "string" && data.devResetToken.length > 0
          ? data.devResetToken
          : "";
      const title = devTok ? t("forgot.devCodeTitle") : t("forgot.inboxTitle");
      const msg =
        (data.message || t("forgot.requestReceivedFallback")) +
        (devTok ? `${t("forgot.devCodeBanner")}${devTok}` : "");
      Alert.alert(title, msg, [
        {
          text: t("forgot.enterCode"),
          onPress: () =>
            navigation.navigate("ResetPassword", { initialToken: devTok }),
        },
        { text: t("forgot.done"), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert(t("forgot.failedTitle"), e.message ?? t("signup.signUpFail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader onMenuPress={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>{t("forgot.hint")}</Text>
        <Text style={styles.label}>{t("forgot.email")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("forgot.placeholderEmail")}
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <GradientButton label={busy ? t("forgot.sending") : t("forgot.send")} onPress={submit} disabled={busy} />

        <Pressable
          onPress={() => navigation.navigate("ResetPassword", {})}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{t("forgot.haveCodeAlready")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  body: {
    padding: 24,
  },
  hint: {
    color: colors.textMuted,
    marginBottom: 20,
    lineHeight: 22,
    fontSize: 15,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    color: colors.textDark,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: colors.white,
  },
  secondary: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  secondaryText: {
    color: colors.accentBlue,
    fontSize: 16,
    fontWeight: "600",
  },
});
