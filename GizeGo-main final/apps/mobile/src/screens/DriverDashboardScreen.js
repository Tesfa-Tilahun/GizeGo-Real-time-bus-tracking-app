import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { GradientButton } from "../components/GradientButton.js";
import { colors } from "../theme/colors.js";
import { fetchDriverAssignment } from "../api/gizegoApi.js";
import { useAuth } from "../context/AuthContext.js";
import { useLocale } from "../context/LocaleContext.js";
import { resolveAvatarUrl } from "../utils/avatarUrl.js";

export function DriverDashboardScreen({ navigation }) {
  const { user, isDriver, signOut } = useAuth();
  const { t } = useLocale();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await fetchDriverAssignment();
      setAssignment(data);
    } catch (e) {
      setError(e.message ?? t("driver.loadFail"));
      setAssignment(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isDriver) {
      navigation.replace("Home");
    }
  }, [isDriver, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (isDriver) void load(true);
    }, [isDriver, load]),
  );

  if (!isDriver) {
    return null;
  }

  const avatarUri = resolveAvatarUrl(user?.avatarUrl);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.headerStart, colors.headerEnd]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.welcome}>{t("driver.welcome", { name: user?.name ?? "" })}</Text>
            <Text style={styles.role}>{t("driver.portal")}</Text>
          </View>
          <Pressable onPress={() => navigation.navigate("DriverProfile")}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{(user?.name ?? "D").charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} />
        }
      >
        <View style={styles.actions}>
          <GradientButton
            label={t("driver.myProfile")}
            onPress={() => navigation.navigate("DriverProfile")}
          />
          <View style={styles.gap} />
          <GradientButton
            label={t("driver.signOut")}
            onPress={async () => {
              await signOut();
              navigation.reset({ index: 0, routes: [{ name: "DriverLogin" }] });
            }}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accentBlue} style={styles.loader} />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error && assignment && !assignment.assigned ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("driver.noBusTitle")}</Text>
            <Text style={styles.cardSub}>{assignment.message ?? t("driver.noBusSub")}</Text>
          </View>
        ) : null}

        {!loading && !error && assignment?.assigned ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("driver.yourBus")}</Text>
            <Text style={styles.busName}>{assignment.bus?.name ?? "—"}</Text>
            {assignment.bus?.operator ? (
              <Text style={styles.operator}>{assignment.bus.operator}</Text>
            ) : null}
            {assignment.bus?.status ? (
              <Text style={styles.meta}>{t("driver.busStatus", { status: assignment.bus.status })}</Text>
            ) : null}

            {assignment.assignments?.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>{t("driver.scheduledRoutes")}</Text>
                {assignment.assignments.map((a) => (
                  <View key={a.routeId} style={styles.routeRow}>
                    <Text style={styles.routeName}>
                      {a.routeCode ? `${a.routeCode} · ` : ""}
                      {a.routeName}
                    </Text>
                    <Text style={styles.routeMeta}>
                      {a.departureStopName ?? "—"} → {a.arrivalStopName ?? "—"}
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.cardSub}>{t("driver.noRoutes")}</Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerText: { flex: 1, paddingRight: 12 },
  welcome: { color: colors.white, fontSize: 22, fontWeight: "800" },
  role: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.white },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarLetter: { color: colors.white, fontSize: 22, fontWeight: "800" },
  body: { padding: 20, paddingBottom: 40 },
  actions: { marginBottom: 16 },
  gap: { height: 10 },
  loader: { marginTop: 24 },
  error: { color: "#c62828", marginTop: 12, textAlign: "center" },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.textDark, marginBottom: 8 },
  cardSub: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
  busName: { fontSize: 20, fontWeight: "800", color: colors.accentBlue },
  operator: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(61, 126, 166, 0.1)",
    color: colors.accentBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "700",
    fontSize: 12,
  },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 10 },
  routeRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12,
  },
  routeName: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  routeMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  routeTime: { fontSize: 13, color: colors.accentBlue, fontWeight: "600", marginTop: 4 },
});
