import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
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
import { colors } from "../theme/colors.js";
import { fetchMyFeedback, submitFeedback } from "../api/gizegoApi.js";
import { useAuth } from "../context/AuthContext.js";
import { useLocale } from "../context/LocaleContext.js";

const CATEGORIES = ["service", "delay", "safety", "driver", "other"];

function StarRow({ value, onChange }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} style={styles.starBtn}>
          <Text style={[styles.star, n <= value && styles.starOn]}>{n <= value ? "★" : "☆"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function FeedbackScreen({ navigation, route }) {
  const { t } = useLocale();
  const { user, ready, isPassenger, signOut, getUser } = useAuth();
  const activeUser = user ?? getUser();
  const passenger = activeUser?.role === "passenger";
  const [menuOpen, setMenuOpen] = useState(false);
  const [rating, setRating] = useState(4);
  const [category, setCategory] = useState("service");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const routeId = route.params?.routeId;
  const routeName = route.params?.routeName;

  const signUpParams = { forFeedback: true, routeId, routeName };

  const loadHistory = useCallback(async () => {
    if (!activeUser || !passenger) return;
    try {
      const data = await fetchMyFeedback();
      setHistory(data.feedback ?? []);
    } catch {
      setHistory([]);
    }
  }, [activeUser, passenger]);

  useFocusEffect(
    useCallback(() => {
      if (activeUser && passenger) {
        void loadHistory();
      }
    }, [activeUser, passenger, loadHistory]),
  );

  const submit = async () => {
    if (comment.trim().length < 3) {
      Alert.alert(t("feedback.title"), t("feedback.commentShort"));
      return;
    }
    setBusy(true);
    try {
      await submitFeedback({
        rating,
        category,
        comment: comment.trim(),
        routeId: routeId || undefined,
      });
      setComment("");
      Alert.alert(t("feedback.title"), t("feedback.thanks"));
      await loadHistory();
    } catch (e) {
      Alert.alert(t("feedback.title"), e.message ?? t("feedback.submitFail"));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <View style={styles.root}>
        <Text style={styles.muted}>{t("feedback.loading")}</Text>
      </View>
    );
  }

  if (!activeUser) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <AppHeader onMenuPress={() => setMenuOpen(true)} />
        <SideMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          navigation={navigation}
          hideDriverLogin
        />
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>{t("feedback.gateTitle")}</Text>
          <Text style={styles.gateSub}>{t("feedback.gateSub")}</Text>
          <GradientButton
            label={t("feedback.signUp")}
            onPress={() => navigation.navigate("SignUp", signUpParams)}
          />
          <View style={styles.gap} />
          <GradientButton
            label={t("feedback.logIn")}
            onPress={() => navigation.navigate("Login", signUpParams)}
          />
        </View>
      </View>
    );
  }

  if (!passenger) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <AppHeader onMenuPress={() => setMenuOpen(true)} />
        <SideMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          navigation={navigation}
          hideDriverLogin
        />
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>{t("feedback.passengerOnly")}</Text>
          <GradientButton label={t("feedback.signOut")} onPress={() => void signOut()} />
          <View style={styles.gap} />
          <GradientButton
            label={t("feedback.signUp")}
            onPress={() => navigation.navigate("SignUp", signUpParams)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader onMenuPress={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("feedback.title")}</Text>
        <Text style={styles.sub}>{t("feedback.sub", { name: activeUser.name })}</Text>
        {routeName ? (
          <Text style={styles.routeHint}>{t("feedback.forRoute", { name: routeName })}</Text>
        ) : null}

        <Text style={styles.label}>{t("feedback.rating")}</Text>
        <StarRow value={rating} onChange={setRating} />

        <Text style={styles.label}>{t("feedback.category")}</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, category === c && styles.chipOn]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipTxt, category === c && styles.chipTxtOn]}>
                {t(`feedback.cat.${c}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t("feedback.comment")}</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={4}
          placeholder={t("feedback.commentPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={comment}
          onChangeText={setComment}
        />

        <View style={styles.submitWrap}>
          <GradientButton
            label={busy ? t("login.pleaseWait") : t("feedback.submit")}
            onPress={submit}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: 24, paddingBottom: 40 },
  gate: { flex: 1, justifyContent: "center", padding: 24 },
  gateTitle: { fontSize: 24, fontWeight: "800", color: colors.textDark, marginBottom: 8 },
  gateSub: { fontSize: 16, color: colors.textMuted, marginBottom: 24, lineHeight: 24 },
  gap: { height: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.textDark, marginBottom: 6 },
  sub: { fontSize: 15, color: colors.textMuted, marginBottom: 20 },
  routeHint: { fontSize: 14, color: colors.accentBlue, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 15, fontWeight: "700", color: colors.textDark, marginTop: 16, marginBottom: 10 },
  stars: { flexDirection: "row", gap: 6, marginBottom: 12 },
  starBtn: { padding: 4 },
  star: { fontSize: 36, color: colors.border },
  starOn: { color: colors.accentBlue },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  chipOn: { borderColor: colors.accentBlue, backgroundColor: colors.accentBlue },
  chipTxt: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  chipTxtOn: { color: colors.white },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    textAlignVertical: "top",
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: colors.white,
    color: colors.textDark,
  },
  submitWrap: {
    marginTop: 8,
  },
  muted: { textAlign: "center", marginTop: 40, color: colors.textMuted, fontSize: 16 },
});
