import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { GradientButton } from "../components/GradientButton.js";
import { colors } from "../theme/colors.js";
import { loginUser } from "../api/gizegoApi.js";
import { useAuth } from "../context/AuthContext.js";
import { useLocale } from "../context/LocaleContext.js";

export function DriverLoginScreen({ navigation }) {
  const { signIn, isDriver } = useAuth();
  const { t } = useLocale();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDriver) {
      navigation.replace("DriverDashboard");
    }
  }, [isDriver, navigation]);

  const submit = async () => {
    const id = identifier.trim();
    if (id.length < 3) {
      Alert.alert(t("driver.loginTitle"), t("login.enterIdHint"));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t("driver.loginTitle"), t("login.passwordShort"));
      return;
    }

    setBusy(true);
    try {
      const data = await loginUser({ identifier: id, password });
      if (!data?.token || !data?.user) {
        Alert.alert(t("driver.loginTitle"), t("login.unexpectedToken"));
        return;
      }
      if (data.user.role !== "driver") {
        Alert.alert(t("driver.loginTitle"), t("driver.driverOnly"));
        return;
      }
      await signIn(data.token, data.user);
      navigation.reset({ index: 0, routes: [{ name: "DriverDashboard" }] });
    } catch (e) {
      Alert.alert(t("driver.loginTitle"), e.message ?? t("login.googleSignInFail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.headerStart, colors.headerEnd]} style={styles.header}>
        <Text style={styles.headerTitle}>{t("driver.loginTitle")}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.welcomeText}>{t("driver.loginWelcome")}</Text>
        <View style={styles.formCard}>
          <Text style={styles.label}>{t("driver.identifier")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("login.valuePlaceholder")}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            value={identifier}
            onChangeText={setIdentifier}
          />

          <Text style={styles.label}>{t("signup.password")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("login.valuePlaceholder")}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <GradientButton
            label={busy ? t("login.pleaseWait") : t("driver.signIn")}
            onPress={submit}
            disabled={busy}
          />

          <Pressable
            onPress={() => navigation.navigate("ForgotPassword", { forDriver: true })}
            style={styles.linkWrap}
          >
            <Text style={styles.link}>{t("driver.forgotPassword")}</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate("Home")} style={styles.linkWrap}>
            <Text style={styles.backLink}>{t("driver.backPassenger")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 24 },
  headerTitle: { color: colors.white, fontSize: 26, fontWeight: "800" },
  body: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  welcomeText: {
    color: colors.accentBlue,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  formCard: {
    width: "100%",
  },
  label: { fontSize: 15, fontWeight: "600", color: colors.textDark, marginBottom: 8, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  linkWrap: { marginTop: 20, alignItems: "center" },
  link: { color: colors.accentBlue, fontWeight: "700", fontSize: 15 },
  backLink: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
});
