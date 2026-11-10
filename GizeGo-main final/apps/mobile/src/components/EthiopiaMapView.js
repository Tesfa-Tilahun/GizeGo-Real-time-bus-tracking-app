import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { UrlTile } from "react-native-maps";
import { ADDIS_ABABA, MAP_ATTRIBUTION, MAP_TILE_URL } from "../config/ethiopiaMap.js";

/**
 * Map centered on Ethiopia using OpenStreetMap raster tiles (real Ethiopian road data).
 */
export function EthiopiaMapView({
  mapRef,
  region,
  initialRegion = ADDIS_ABABA,
  onRegionChangeComplete,
  showsUserLocation = true,
  followsUserLocation = false,
  showsMyLocationButton = true,
  children,
  style,
}) {
  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={Platform.OS === "android" ? "none" : "mutedStandard"}
        initialRegion={initialRegion}
        region={region ?? undefined}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={showsMyLocationButton}
        showsCompass
        followsUserLocation={followsUserLocation}
        userLocationPriority="high"
        userLocationUpdateInterval={3000}
        userLocationFastestInterval={2000}
      >
        <UrlTile
          urlTemplate={MAP_TILE_URL}
          maximumZ={19}
          minimumZ={4}
          tileSize={256}
          shouldReplaceMapContent={Platform.OS === "ios"}
          zIndex={-1}
        />
        {children}
      </MapView>
      <Text style={styles.attribution} pointerEvents="none">
        {MAP_ATTRIBUTION}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  attribution: {
    position: "absolute",
    left: 8,
    bottom: 6,
    fontSize: 10,
    color: "rgba(0,0,0,0.55)",
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: "hidden",
  },
});
