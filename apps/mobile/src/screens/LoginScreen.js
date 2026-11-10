import { useState, useEffect } from "react";
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
import { AppHeader } from "../components/AppHeader.js";
import { GradientButton } from "../components/GradientButton.js";
import { SideMenu } from "../components/SideMenu.js";
import { ContactFooter, SocialRow } from "../components/ScreenFooter.js";
import { colors } from "../theme/colors.js";
import { loginUser, googleSignInWithIdToken } from "../api/gizegoApi.js";
import { useAuth } from "../context/AuthContext.js";
import { API_BASE_URL } from "../config/api.js";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn.js";
import { useLocale } from "../context/LocaleContext.js";

export function LoginScreen({ navigation, route: navRoute }) {
  const forFeedback = Boolean(navRoute.params?.forFeedback);
  const routeId = navRoute.params?.routeId;
  const routeName = navRoute.params?.routeName;
  const feedbackReturnParams = { routeId, routeName };
  const signUpParams = { forFeedback: true, routeId, routeName };
  const { signIn, signOut } = useAuth();
  const { t } = useLocale();
  const { idToken, prompt, clearIdToken, configured } = useGoogleSignIn();
  const [menuOpen, setMenuOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    (async () => {
      setGoogleBusy(true);
      try {
        const data = await googleSignInWithIdToken(idToken);
        if (cancelled) return;
        clearIdToken();
        if (!data?.token || !data?.user) {
          Alert.alert(t("login.googleUnexpected"), t("login.unexpectedToken"));
          return;
        }
        await signIn(data.token, data.user);
        if (forFeedback) {
          if (data.user.role !== "passenger") {
            await signOut();
            Alert.alert(t("feedback.title"), t("feedback.passengerOnly"));
            return;
          }
          navigation.reset({
            index: 0,
            routes: [
              {
                name: "Feedback",
                params: { ...feedbackReturnParams, forFeedback: true },
              },
            ],
          });
          return;
        }
        if (data.user.role === "driver") {
          navigation.reset({ index: 0, routes: [{ name: "DriverDashboard" }] });
          return;
        }
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "Home",
              params: { source: "google" },
            },
          ],
        });
      } catch (e) {
        if (!cancelled) Alert.alert(t("login.googleUnexpected"), e.message ?? t("login.googleSignInFail"));
      } finally {
        if (!cancelled) setGoogleBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idToken, signIn, navigation, clearIdToken]);

  const submit = async () => {
    const id = identifier.trim();
    if (id.length < 3) {
      Alert.alert(t("login.alertShortId"), t("login.enterIdHint"));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t("login.alertShortId"), t("login.passwordShort"));
      return;
    }

    setBusy(true);
    try {
      const data = await loginUser({ identifier: id, password });
      if (!data?.token || !data?.user) {
        Alert.alert(t("login.alertShortId"), t("login.unexpectedToken"));
        return;
      }
      await signIn(data.token, data.user);
      if (forFeedback) {
        if (data.user.role !== "passenger") {
          await signOut();
          Alert.alert(t("feedback.title"), t("feedback.passengerOnly"));
          return;
        }
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "Feedback",
              params: { ...feedbackReturnParams, forFeedback: true },
            },
          ],
        });
        return;
      }
      if (data.user.role === "driver") {
        navigation.reset({ index: 0, routes: [{ name: "DriverDashboard" }] });
        return;
      }
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Home",
            params: { source: "login" },
          },
        ],
      });
    } catch (e) {
      Alert.alert(t("login.alertShortId"), e.message ?? t("signup.signUpFail"));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!configured) {
      Alert.alert(t("login.googleCfgTitle"), t("google.setupMessage"));
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
        {!forFeedback && __DEV__ ? (
          <Text style={styles.devHint} numberOfLines={2}>
            {t("dev.apiPrefix")} {API_BASE_URL}
          </Text>
        ) : null}

        <Text style={styles.fieldLabel}>{t("login.emailPhone")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("login.valuePlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          value={identifier}
          onChangeText={setIdentifier}
        />

        <Text style={styles.fieldLabel}>{t("login.password")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("login.valuePlaceholder")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <GradientButton label={busy ? t("login.pleaseWait") : t("login.submit")} onPress={submit} disabled={busy} />

        <Pressable onPress={() => navigation.navigate("ForgotPassword", { forFeedback })} style={styles.forgotWrap}>
          <Text style={styles.forgot}>{t("login.forgot")}</Text>
        </Pressable>

        {forFeedback ? (
          <Pressable onPress={() => navigation.navigate("Feedback", signUpParams)} style={styles.backFeedbackWrap}>
            <Text style={styles.backFeedback}>{t("feedback.backToGate")}</Text>
          </Pressable>
        ) : null}

        {!forFeedback ? (
          <>
            <Pressable
              onPress={() => navigation.navigate("ResetPassword", {})}
              style={styles.resetCodeWrap}
            >
              <Text style={styles.resetCode}>{t("login.resetCode")}</Text>
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.line} />
              <Text style={styles.or}>{t("login.or")}</Text>
              <View style={styles.line} />
            </View>

            <GradientButton
              label={googleBusy ? t("login.pleaseWait") : t("login.withGoogle")}
              onPress={google}
              disabled={googleBusy}
            />

            <Text style={styles.signUpPrompt}>
              {t("login.noAccount")}
              <Text style={styles.link} onPress={() => navigation.navigate("SignUp")}>
                {t("login.signUpLink")}
              </Text>
            </Text>
          </>
        ) : (
          <Text style={styles.signUpPrompt}>
            {t("login.noAccount")}
            <Text
              style={styles.link}
              onPress={() =>
                navigation.navigate("SignUp", { forFeedback: true, routeId, routeName })
              }
            >
              {t("login.signUpLink")}
            </Text>
          </Text>
        )}

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
  forgotWrap: {
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 8,
  },
  forgot: {
    color: colors.accentBlue,
    fontSize: 15,
  },
  backFeedbackWrap: {
    alignSelf: "center",
    marginTop: 12,
  },
  backFeedback: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  resetCodeWrap: {
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  resetCode: {
    color: colors.textMuted,
    fontSize: 14,
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
  },
  signUpPrompt: {
    textAlign: "center",
    marginTop: 20,
    color: colors.textMuted,
    fontSize: 15,
  },
  link: {
    color: colors.accentBlue,
    fontWeight: "700",
  },
});
