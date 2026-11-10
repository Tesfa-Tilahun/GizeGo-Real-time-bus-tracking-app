import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors } from "../theme/colors.js";

/**
 * Shortest path + alternative route chips (Google Maps style).
 */
export function RouteAlternativesBar({ options, selectedKey, onSelect, t }) {
  if (!options?.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.content}
    >
      {options.map((opt) => {
        const active = selectedKey === opt.key;
        return (
          <Pressable
            key={opt.key}
            style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
            onPress={() => onSelect(opt.key)}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
            {opt.km != null ? (
              <Text style={[styles.meta, active && styles.metaActive]}>
                {t("map.fmtKm", { km: opt.km })}
              </Text>
            ) : null}
            {opt.minutes != null ? (
              <Text style={[styles.meta, active && styles.metaActive]}>
                {t("map.fmtEta", { min: opt.minutes })}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    maxHeight: 72,
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 4,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    minWidth: 88,
  },
  chipActive: {
    backgroundColor: "#1a237e",
    borderColor: "#1a237e",
  },
  chipIdle: {
    backgroundColor: "#fff",
    borderColor: "#cfd8dc",
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textDark,
  },
  labelActive: {
    color: "#fff",
  },
  meta: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: 2,
  },
  metaActive: {
    color: "rgba(255,255,255,0.85)",
  },
});
