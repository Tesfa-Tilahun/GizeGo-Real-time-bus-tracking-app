import { useState, useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { resetPasswordWithToken } from "../api/gizegoApi.js";
import { AppHeader } from "../components/AppHeader.js";
import { GradientButton } from "../components/GradientButton.js";
import { SideMenu } from "../components/SideMenu.js";
import { colors } from "../theme/colors.js";
import { useLocale } from "../context/LocaleContext.js";

export function ResetPasswordScreen({ navigation, route }) {
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const initial = route?.params?.initialToken?.trim?.();
    if (initial) setToken(initial);
  }, [route?.params?.initialToken]);

  const submit = async () => {
    const tok = token.trim();
    if (tok.length < 16) {
      Alert.alert(t("reset.alertTitle"), t("reset.needCode"));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t("reset.alertTitle"), t("reset.passwordShort"));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t("reset.alertTitle"), t("reset.mismatch"));
      return;
    }
    setBusy(true);
    try {
      await resetPasswordWithToken(tok, password);
      Alert.alert(t("reset.successTitle"), t("reset.successMsg"), [
        { text: t("reset.ok"), onPress: () => navigation.navigate("Login") },
      ]);
    } catch (e) {
      Alert.alert(t("reset.alertTitle"), e.message ?? t("reset.failedFallback"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader onMenuPress={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>{t("reset.hint")}</Text>

        <Text style={styles.label}>{t("reset.codeLabel")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("reset.tokenPlaceholder")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          value={token}
          onChangeText={setToken}
        />

        <Text style={styles.label}>{t("reset.newPass")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("reset.newPassPlaceholder")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>{t("reset.confirm")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("reset.confirmPlaceholder")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <GradientButton label={busy ? t("reset.saveBusy") : t("reset.submit")} onPress={submit} disabled={busy} />

        <Pressable onPress={() => navigation.navigate("Login")} style={styles.back}>
          <Text style={styles.backText}>{t("reset.backLogin")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: 24, paddingBottom: 40 },
  hint: { color: colors.textMuted, marginBottom: 20, lineHeight: 22, fontSize: 15 },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 8, color: colors.textDark },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: colors.white,
  },
  back: { marginTop: 20, alignSelf: "center" },
  backText: { color: colors.accentBlue, fontSize: 16, fontWeight: "600" },
});
