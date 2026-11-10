import { useState, useEffect } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppHeader } from "../components/AppHeader.js";
import { GradientButton } from "../components/GradientButton.js";
import { SideMenu } from "../components/SideMenu.js";
import { ContactFooter, SocialRow } from "../components/ScreenFooter.js";
import { colors } from "../theme/colors.js";
import { registerUser, googleSignInWithIdToken } from "../api/gizegoApi.js";
import { useAuth } from "../context/AuthContext.js";
import { API_BASE_URL } from "../config/api.js";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn.js";
import { useLocale } from "../context/LocaleContext.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpScreen({ navigation, route: navRoute }) {
  const forFeedback = Boolean(navRoute.params?.forFeedback);
  const routeId = navRoute.params?.routeId;
  const routeName = navRoute.params?.routeName;
  const feedbackReturnParams = { routeId, routeName };
  const { signIn } = useAuth();
  const { t } = useLocale();
  const { idToken, prompt, clearIdToken, configured } = useGoogleSignIn();
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!idToken || forFeedback) return;
    let cancelled = false;
    (async () => {
      setGoogleBusy(true);
      try {
        const data = await googleSignInWithIdToken(idToken);
        if (cancelled) return;
        clearIdToken();
        if (!data?.token || !data?.user) {
          Alert.alert(t("login.googleUnexpected"), t("signup.unexpectedToken"));
          return;
        }
        await signIn(data.token, data.user);
        navigation.reset({
          index: 0,
          routes: [{ name: "Home", params: { source: "google" } }],
        });
      } catch (e) {
        if (!cancelled) Alert.alert(t("login.googleUnexpected"), e.message ?? t("signup.googleSignFail"));
      } finally {
        if (!cancelled) setGoogleBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idToken, signIn, navigation, clearIdToken]);

  const submit = async () => {
    const n = name.trim();
    const em = email.trim();
    const ph = phone.trim().replace(/\s+/g, "");

    if (n.length < 2 || n.length > 120) {
      Alert.alert(t("signup.title"), t("signup.nameLen"));
      return;
    }
    if (!em && !ph) {
      Alert.alert(t("signup.title"), t("signup.emailOrPhone"));
      return;
    }
    if (em && !EMAIL_RE.test(em)) {
      Alert.alert(t("signup.title"), t("signup.invalidEmail"));
      return;
    }
    if (ph && (ph.length < 7 || ph.length > 30)) {
      Alert.alert(t("signup.title"), t("signup.phoneLen"));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t("signup.title"), t("signup.passwordShort"));
      return;
    }

    setBusy(true);
    try {
      const data = await registerUser({
        name: n,
        email: em || undefined,
        phone: ph || undefined,
        password,
        role: "passenger",
      });
      if (!data?.token || !data?.user) {
        Alert.alert(t("signup.title"), t("signup.unexpectedToken"));
        return;
      }
      if (data.user.role !== "passenger") {
        Alert.alert(t("feedback.title"), t("feedback.passengerOnly"));
        return;
      }
      await signIn(data.token, data.user);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: forFeedback ? "Feedback" : "Home",
            params: forFeedback ? { ...feedbackReturnParams, forFeedback: true } : { source: "signup" },
          },
        ],
      });
    } catch (e) {
      Alert.alert(t("signup.title"), e.message ?? t("signup.signUpFail"));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!configured) {
      Alert.alert(t("signup.googleCfgTitle"), t("google.setupMessage"));
      return;
    }
    const res = await prompt();
    if (res?.type === "cancel" || res?.type === "dismiss") return;
    if (res?.type === "error") {
      Alert.alert(t("login.googleUnexpected"), res.error?.message ?? res.params?.error ?? t("login.googleSignInFail"));
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader onMenuPress={() => setMenuOpen(true)} />
      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        hideDriverLogin={forFeedback}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {forFeedback ? <Text style={styles.feedbackTitle}>{t("feedback.signUpTitle")}</Text> : null}
        {!forFeedback && __DEV__ ? (
          <Text style={styles.devHint} numberOfLines={2}>
            {t("dev.apiPrefix")} {API_BASE_URL}
          </Text>
        ) : null}

        <Text style={styles.fieldLabel}>{t("signup.fullName")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("login.valuePlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.fieldLabel}>{t("signup.emailOpt")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("login.valuePlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.fieldLabel}>{t("signup.phoneOpt")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("signup.phonePlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.fieldLabel}>{t("signup.password")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("login.valuePlaceholder")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <View style={styles.gap} />
        <GradientButton
          label={busy ? t("login.pleaseWait") : forFeedback ? t("feedback.signUpSubmit") : t("signup.submit")}
          onPress={submit}
          disabled={busy}
        />

        {!forFeedback ? (
          <>
            <View style={styles.orRow}>
              <View style={styles.line} />
              <Text style={styles.or}>{t("login.or")}</Text>
              <View style={styles.line} />
            </View>

            <GradientButton
              label={googleBusy ? t("login.pleaseWait") : t("signup.withGoogle")}
              onPress={google}
              disabled={googleBusy}
            />
          </>
        ) : null}

        <Text style={styles.loginPrompt}>
          {t("signup.hasAccount")}
          <Text
            style={styles.link}
            onPress={() =>
              navigation.navigate("Login", { forFeedback, routeId, routeName })
            }
          >
            {t("signup.logInLink")}
          </Text>
        </Text>

        {!forFeedback ? <SocialRow /> : null}
      </ScrollView>

      {!forFeedback ? <ContactFooter /> : null}
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
    paddingBottom: 40,
  },
  devHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
  },
  feedbackTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textDark,
    marginBottom: 8,
  },
  feedbackHint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 15,
    color: colors.textDark,
    marginBottom: 8,
    fontWeight: "600",
  },
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
  gap: {
    height: 8,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  or: {
    marginHorizontal: 12,
    color: colors.textMuted,
    fontSize: 14,
  },
  loginPrompt: {
    textAlign: "center",
    marginTop: 24,
    color: colors.textMuted,
    fontSize: 15,
  },
  link: {
    color: colors.accentBlue,
    fontWeight: "700",
  },
});
