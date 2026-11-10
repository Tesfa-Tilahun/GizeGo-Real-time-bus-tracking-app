import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors.js";

const SEV = {
  warning: { bg: "#fff3e0", border: "#f57c00", text: "#e65100" },
  info: { bg: "#e8f4fc", border: colors.accentBlue, text: "#1565c0" },
  error: { bg: "#ffebee", border: "#c62828", text: "#b71c1c" },
  arrived: { bg: "#e8f5e9", border: "#2e7d32", text: "#1b5e20" },
};

export function AlertBanner({ alerts, onDismiss }) {
  if (!alerts?.length) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {alerts.slice(0, 3).map((a) => {
        const s =
          a.type === "bus_arrived" ? SEV.arrived : (SEV[a.severity] ?? SEV.info);
        return (
          <Pressable
            key={a.id}
            style={[styles.card, { backgroundColor: s.bg, borderColor: s.border }]}
            onPress={() => onDismiss(a.id)}
          >
            <Text style={[styles.title, { color: s.text }]}>
              {a.type === "bus_arrived" ? "✓ " : ""}
              {a.title}
            </Text>
            <Text style={styles.msg}>{a.message}</Text>
            {a.waitMinutes != null && a.waitMinutes > 0 ? (
              <Text style={[styles.wait, { color: s.text }]}>
                ⏱ ~{a.waitMinutes} min
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    zIndex: 20,
    gap: 6,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: { fontSize: 13, fontWeight: "800" },
  msg: { fontSize: 12, color: colors.textDark, marginTop: 2 },
  wait: { fontSize: 11, fontWeight: "700", marginTop: 4 },
});
