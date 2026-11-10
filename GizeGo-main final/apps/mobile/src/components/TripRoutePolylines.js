import { StyleSheet, Text, View } from "react-native";
import { Marker, Polyline } from "react-native-maps";
import { pointAlongPath } from "../utils/routePolyline.js";

/** Midpoint coordinate along a path (for duration labels). */
export function midpointOfPath(coordinates) {
  if (!coordinates?.length) return null;
  return coordinates[Math.floor(coordinates.length / 2)];
}

/** Label position along a path (0–1) to reduce badge overlap. */
export function labelPointOnPath(coordinates, fraction = 0.5) {
  if (!coordinates?.length) return null;
  const sample = pointAlongPath(coordinates, fraction);
  return sample?.point ?? midpointOfPath(coordinates);
}

const PRIMARY = {
  halo: "rgba(255,255,255,0.98)",
  shadow: "#0a3d7a",
  outline: "#1565c0",
  main: "#1a73e8",
  widths: [28, 20, 14, 9],
  z: [3, 4, 5, 6],
};

const ALTERNATIVE = {
  halo: "rgba(255,255,255,0.85)",
  shadow: "rgba(0,0,0,0.18)",
  outline: "#6a1b9a",
  main: "#ab47bc",
  widths: [24, 17, 12, 8],
  z: [1, 2, 3, 4],
};

const LONGEST = {
  halo: "rgba(255,255,255,0.95)",
  shadow: "#bf360c",
  outline: "#e65100",
  main: "#ff6d00",
  widths: [26, 19, 14, 10],
  z: [2, 3, 4, 5],
};

const ALTERNATIVE_COLORS = [
  { outline: "#6a1b9a", main: "#ab47bc" },
  { outline: "#ef6c00", main: "#ff9800" },
  { outline: "#00838f", main: "#00acc1" },
  { outline: "#2e7d32", main: "#66bb6a" },
  { outline: "#ad1457", main: "#ec407a" },
];

/**
 * Route polyline — primary (bold blue) or alternative (bold colored), Google Maps style.
 */
export function TripRoutePolylines({ coordinates, variant = "primary", colorIndex = 0 }) {
  if (!coordinates?.length || coordinates.length < 2) return null;

  let palette;
  if (variant === "longest") {
    palette = LONGEST;
  } else if (variant === "alternative") {
    const altColor = ALTERNATIVE_COLORS[colorIndex % ALTERNATIVE_COLORS.length];
    palette = { ...ALTERNATIVE, outline: altColor.outline, main: altColor.main };
  } else {
    palette = PRIMARY;
  }
  const lineProps = { lineCap: "round", lineJoin: "round" };

  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor={palette.halo}
        strokeWidth={palette.widths[0]}
        zIndex={palette.z[0]}
        {...lineProps}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={palette.shadow}
        strokeWidth={palette.widths[1]}
        zIndex={palette.z[1]}
        {...lineProps}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={palette.outline}
        strokeWidth={palette.widths[2]}
        zIndex={palette.z[2]}
        {...lineProps}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={palette.main}
        strokeWidth={palette.widths[3]}
        zIndex={palette.z[3]}
        {...lineProps}
      />
    </>
  );
}

/** Distance / duration bubble on the path (e.g. "7.0 km · ~9 min"). */
export function RouteDurationBadge({
  coordinate,
  minutes,
  kilometers,
  primary = false,
  label,
  variant,
}) {
  if (!coordinate) return null;
  if (label == null && kilometers == null && minutes == null) return null;

  let text = label;
  if (text == null) {
    const kmPart = kilometers != null ? `${kilometers} km` : null;
    const minPart = minutes != null ? `~${minutes} min` : null;
    text = [kmPart, minPart].filter(Boolean).join(" · ");
  }

  const isLongest = variant === "longest";

  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} zIndex={primary ? 12 : isLongest ? 10 : 8}>
      <View
        style={[
          styles.badge,
          primary ? styles.badgePrimary : isLongest ? styles.badgeLongest : styles.badgeAlt,
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            primary ? styles.badgeTextPrimary : isLongest ? styles.badgeTextLongest : styles.badgeTextAlt,
          ]}
        >
          {text}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    minWidth: 44,
    alignItems: "center",
  },
  badgePrimary: {
    backgroundColor: "#1a237e",
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  badgeAlt: {
    backgroundColor: "#ffffff",
    borderColor: "#cfd8dc",
  },
  badgeLongest: {
    backgroundColor: "#fff3e0",
    borderColor: "#ff6d00",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  badgeTextPrimary: {
    color: "#ffffff",
  },
  badgeTextAlt: {
    color: "#546e7a",
  },
  badgeTextLongest: {
    color: "#e65100",
  },
});
