import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

function busColor(status) {
  if (status === "arrived") return "#2e7d32";
  if (status === "delayed") return "#f57c00";
  if (status === "stopped") return "#757575";
  return "#1a73e8";
}

/** Animated-style bus marker on the map. */
export function BusMapMarker({ bus, isNearest, title, description, onPress }) {
  const color = busColor(bus.status);
  return (
    <Marker
      coordinate={{ latitude: bus.latitude, longitude: bus.longitude }}
      title={title}
      description={description}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={bus.heading ?? 0}
      onPress={onPress}
      zIndex={isNearest ? 10 : 6}
    >
      <View style={[styles.wrap, isNearest && styles.wrapNearest]}>
        <View style={[styles.ring, { borderColor: color }]} />
        <View style={[styles.body, { backgroundColor: color }]}>
          <Text style={styles.icon}>🚌</Text>
        </View>
        {isNearest ? <View style={styles.pulse} /> : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  wrapNearest: {
    width: 52,
    height: 52,
  },
  ring: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  body: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  icon: {
    fontSize: 16,
  },
  pulse: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(26,115,232,0.35)",
    backgroundColor: "rgba(26,115,232,0.08)",
  },
});
