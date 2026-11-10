import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors.js";
import { useLocale } from "../context/LocaleContext.js";
import { useNotifications } from "../context/RealtimeContext.js";
import { useAuth } from "../context/AuthContext.js";

const SEV = {
  warning: { bg: "#fff8e1", border: "#f57c00", text: "#e65100" },
  info: { bg: "#e8f4fc", border: colors.accentBlue, text: "#1565c0" },
  error: { bg: "#ffebee", border: "#c62828", text: "#b71c1c" },
};

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function SideMenu({ visible, onClose, navigation, hideDriverLogin = false }) {
  const { t } = useLocale();
  const { user, isPassenger, isDriver, ready } = useAuth();
  const { alerts, dismiss, clearAll, socketConnected, watchedRouteId } = useNotifications();

  const routeAlerts = useMemo(
    () =>
      alerts.filter(
        (a) => !watchedRouteId || !a.routeId || a.routeId === watchedRouteId,
      ),
    [alerts, watchedRouteId],
  );

  const go = (screen) => {
    onClose();
    setTimeout(() => navigation.navigate(screen), 0);
  };

  const goFeedback = () => {
    onClose();
    setTimeout(() => {
      if (!ready) {
        navigation.navigate("SignUp", { forFeedback: true });
        return;
      }
      if (user && isPassenger) {
        navigation.navigate("Feedback");
      } else if (!user) {
        navigation.navigate("SignUp", { forFeedback: true });
      } else {
        navigation.navigate("Feedback");
      }
    }, 0);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={[colors.headerStart, colors.headerEnd]} style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("menu.menu")}</Text>
          </LinearGradient>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Pressable style={styles.item} onPress={() => go("Home")}>
              <Text style={styles.itemText}>{t("menu.home")}</Text>
            </Pressable>
            <Pressable style={styles.item} onPress={() => go("Map")}>
              <Text style={styles.itemText}>{t("menu.liveMap")}</Text>
            </Pressable>
            <Pressable style={styles.item} onPress={() => go("BrowseRoutes")}>
              <Text style={styles.itemText}>{t("menu.mapRoutes")}</Text>
            </Pressable>
            <Pressable style={styles.item} onPress={goFeedback}>
              <Text style={styles.itemText}>{t("menu.feedback")}</Text>
            </Pressable>
            {!isDriver && !hideDriverLogin ? (
              <Pressable style={styles.item} onPress={() => go("DriverLogin")}>
                <Text style={styles.itemText}>{t("menu.driverLogin")}</Text>
              </Pressable>
            ) : null}

            <View style={styles.notifSection}>
              <View style={styles.notifHeaderRow}>
                <Text style={styles.notifSectionTitle}>{t("menu.notifications")}</Text>
                {routeAlerts.length > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{routeAlerts.length}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.notifHint}>{t("menu.notificationsHint")}</Text>
              {!socketConnected ? (
                <Text style={styles.notifWarn}>{t("menu.notificationsOffline")}</Text>
              ) : null}

              {routeAlerts.length === 0 ? (
                <Text style={styles.notifEmpty}>{t("menu.noNotifications")}</Text>
              ) : (
                <>
                  {routeAlerts.map((a) => {
                    const s = SEV[a.severity] ?? SEV.info;
                    return (
                      <Pressable
                        key={a.id}
                        style={[styles.notifCard, { backgroundColor: s.bg, borderColor: s.border }]}
                        onPress={() => dismiss(a.id)}
                      >
                        <View style={styles.notifCardTop}>
                          <Text style={[styles.notifTitle, { color: s.text }]} numberOfLines={1}>
                            {a.title || t("menu.notificationFallback")}
                          </Text>
                          <Text style={styles.notifTime}>{formatTime(a.at)}</Text>
                        </View>
                        <Text style={styles.notifMsg}>{a.message}</Text>
                        {a.waitMinutes != null && a.waitMinutes > 0 ? (
                          <Text style={[styles.notifWait, { color: s.text }]}>
                            {t("menu.waitMinutes", { min: a.waitMinutes })}
                          </Text>
                        ) : null}
                        <Text style={styles.notifDismiss}>{t("menu.tapToDismiss")}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable style={styles.clearBtn} onPress={clearAll}>
                    <Text style={styles.clearBtnText}>{t("menu.clearNotifications")}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    flexDirection: "row",
  },
  sheet: {
    width: "82%",
    maxWidth: 340,
    backgroundColor: colors.white,
    maxHeight: "100%",
  },
  sheetHeader: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  sheetTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
  },
  scroll: {
    flexGrow: 0,
    maxHeight: "88%",
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemText: {
    fontSize: 16,
    color: colors.textDark,
  },
  notifSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  notifHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  notifSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textDark,
  },
  notifHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 10,
  },
  notifWarn: {
    fontSize: 11,
    color: "#c62828",
    marginBottom: 8,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: colors.accentBlue,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  notifEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  notifCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  notifCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  notifTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  notifMsg: {
    fontSize: 12,
    color: colors.textDark,
    marginTop: 4,
    lineHeight: 17,
  },
  notifWait: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  notifDismiss: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
  },
  clearBtn: {
    alignSelf: "center",
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  clearBtnText: {
    fontSize: 13,
    color: colors.accentBlue,
    fontWeight: "600",
  },
});
