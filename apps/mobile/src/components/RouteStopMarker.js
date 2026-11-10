import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

export function RouteStopMarker({ stop, description }) {
  return (
    <Marker
      coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
      title={stop.name}
      description={description}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.dot}>
        <Text style={styles.plus}>+</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0d7377",
    borderWidth: 2.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: -1,
  },
});
