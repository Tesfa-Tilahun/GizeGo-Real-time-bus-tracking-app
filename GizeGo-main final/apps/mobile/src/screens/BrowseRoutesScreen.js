import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { AppHeader } from "../components/AppHeader.js";
import { GradientButton } from "../components/GradientButton.js";
import { SideMenu } from "../components/SideMenu.js";
import { colors } from "../theme/colors.js";
import { useLocale } from "../context/LocaleContext.js";
import { listRouteSummaries, fetchRouteStops } from "../api/gizegoApi.js";
import {
  filterRoutesByOperator,
  formatRouteDistance,
  formatRouteDuration,
} from "../utils/routeDisplay.js";

const OPERATORS = [
  { id: "all", labelKey: "home.operatorAll" },
  { id: "ambessa", labelKey: "home.operatorAmbessa" },
  { id: "addis", labelKey: "home.operatorAddis" },
  { id: "shega", labelKey: "home.operatorShega" },
];

export function BrowseRoutesScreen({ navigation }) {
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [stopsByRoute, setStopsByRoute] = useState({});
  const [operatorFilter, setOperatorFilter] = useState("all");

  const filteredRoutes = useMemo(() => {
    return filterRoutesByOperator(routes, operatorFilter);
  }, [routes, operatorFilter]);

  const loadRoutes = useCallback(async () => {
    const data = await listRouteSummaries();
    return data.routes ?? [];
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const list = await loadRoutes();
          if (active) setRoutes(list);
        } catch {
          if (active) setRoutes([]);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [loadRoutes]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const list = await loadRoutes();
      setRoutes(list);
    } catch {
      setRoutes([]);
    } finally {
      setRefreshing(false);
    }
  };

  const openRouteOnMap = (routeId) => {
    navigation.navigate("Map", { routeId });
  };

  const toggleStops = async (routeId) => {
    if (expandedId === routeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(routeId);
    if (!stopsByRoute[routeId]) {
      try {
        const data = await fetchRouteStops(routeId);
        setStopsByRoute((prev) => ({ ...prev, [routeId]: data.stops ?? [] }));
      } catch {
        setStopsByRoute((prev) => ({ ...prev, [routeId]: [] }));
      }
    }
  };

  const renderRow = ({ item }) => {
    const expanded = expandedId === item.id;
    const stops = stopsByRoute[item.id] ?? [];
    return (
      <View style={styles.card}>
        <Pressable style={styles.routeInfo} onPress={() => openRouteOnMap(item.id)}>
          <Text style={styles.routeName}>
            {item.code ? `${item.code} · ` : ""}
            {item.name}
          </Text>
          <Text style={styles.meta}>
            {formatRouteDuration(item.durationMinutes)}
            {" · "}
            {formatRouteDistance(item.distanceMeters)}
            {" · "}
            {t("routesBrowse.priceEtb", { price: item.price ?? "—" })}
            {" · "}
            {t("routesBrowse.stopsLabel", { count: item.stopCount ?? 0 })}
            {" · "}
            {t("routesBrowse.busesLabel", { count: item.busCount ?? 0 })}
          </Text>
        </Pressable>
        <View style={styles.actionRow}>
          <Pressable style={styles.openRouteBtn} onPress={() => openRouteOnMap(item.id)}>
            <Text style={styles.openRouteBtnTxt}>{t("routesBrowse.tapForMap")}</Text>
          </Pressable>
          <Pressable style={styles.stopsToggle} onPress={() => void toggleStops(item.id)}>
            <Text style={styles.stopsToggleTxt}>
              {expanded ? t("routesBrowse.hideStops") : t("routesBrowse.showStops")}
            </Text>
          </Pressable>
        </View>
        {expanded && stops.length > 0 ? (
          <View style={styles.stopsList}>
            {stops.map((s) => (
              <Text key={s.id} style={styles.stopRow}>
                {s.sequenceOrder}. {s.name}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader onMenuPress={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />

      <View style={styles.header}>
        <Text style={styles.title}>{t("routesBrowse.title")}</Text>
        <View style={styles.btnWrap}>
          <GradientButton label={t("routesBrowse.openMap")} onPress={() => navigation.navigate("Map")} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.operatorScroll}
          contentContainerStyle={styles.operatorRow}
        >
          {OPERATORS.map((op) => (
            <Pressable
              key={op.id}
              style={[styles.operatorChip, operatorFilter === op.id && styles.operatorChipActive]}
              onPress={() => setOperatorFilter(op.id)}
            >
              <Text
                style={[
                  styles.operatorChipTxt,
                  operatorFilter === op.id && styles.operatorChipTxtActive,
                ]}
              >
                {t(op.labelKey)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.accentBlue} />
      ) : (
        <FlatList
          contentContainerStyle={styles.listPad}
          data={filteredRoutes}
          keyExtractor={(it) => it.id}
          renderItem={renderRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t("routesBrowse.empty")}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 12,
  },
  btnWrap: {
    marginBottom: 16,
  },
  operatorScroll: {
    marginTop: 4,
  },
  operatorRow: {
    gap: 8,
    paddingBottom: 10,
  },
  operatorChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(61, 126, 166, 0.3)",
    backgroundColor: "rgba(61, 126, 166, 0.1)",
    marginRight: 8,
  },
  operatorChipActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  operatorChipTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentBlue,
  },
  operatorChipTxtActive: {
    color: colors.white,
  },
  loader: { marginTop: 40 },
  listPad: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  routeInfo: {
    marginBottom: 12,
  },
  routeName: { fontSize: 16, fontWeight: "700", color: colors.textDark, lineHeight: 22 },
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  openRouteBtn: {
    flexGrow: 1,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  openRouteBtnTxt: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  stopsToggle: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  stopsToggleTxt: { fontSize: 13, fontWeight: "700", color: colors.accentBlue },
  stopsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stopRow: { fontSize: 13, color: colors.textDark, marginBottom: 4 },
  empty: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 32,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
});
