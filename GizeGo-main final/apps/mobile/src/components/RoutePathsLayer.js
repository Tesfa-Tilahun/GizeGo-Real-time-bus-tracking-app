import {
  TripRoutePolylines,
  RouteDurationBadge,
  labelPointOnPath,
} from "./TripRoutePolylines.js";
import { formatKmOneDecimal } from "../utils/travelMetrics.js";

/**
 * Shortest (bold blue), longest (bold orange), alternatives (bold colored) with km labels.
 */
export function RoutePathsLayer({
  primaryCoords,
  primaryMinutes,
  primaryDistanceMeters,
  longestPath = null,
  alternatives = [],
}) {
  const showPrimary = primaryCoords?.length > 1;
  const longestCoords = longestPath?.coordinates;
  const showLongest = longestCoords?.length > 1;
  const longestId = longestPath?.routeId ?? "longest";
  const alts = alternatives.filter(
    (a) => a.coordinates?.length > 1 && a.routeId !== longestId,
  );
  const primaryKm = formatKmOneDecimal(primaryDistanceMeters);
  const longestKm = formatKmOneDecimal(longestPath?.distanceMeters);

  return (
    <>
      {alts.map((alt, index) => (
        <TripRoutePolylines
          key={alt.routeId ?? alt.name ?? `alt-${index}`}
          coordinates={alt.coordinates}
          variant="alternative"
          colorIndex={index}
        />
      ))}

      {showLongest ? (
        <TripRoutePolylines coordinates={longestCoords} variant="longest" />
      ) : null}

      {showPrimary ? (
        <TripRoutePolylines coordinates={primaryCoords} variant="primary" />
      ) : null}

      {alts.map((alt, index) => {
        const km = formatKmOneDecimal(alt.distanceMeters);
        const fraction = 0.35 + (index % 3) * 0.15;
        return (
          <RouteDurationBadge
            key={`badge-alt-${alt.routeId ?? alt.name ?? index}`}
            coordinate={labelPointOnPath(alt.coordinates, fraction)}
            minutes={alt.durationMinutes}
            kilometers={km}
            primary={false}
          />
        );
      })}

      {showLongest && (longestKm != null || longestPath?.durationMinutes != null) ? (
        <RouteDurationBadge
          coordinate={labelPointOnPath(longestCoords, 0.62)}
          minutes={longestPath.durationMinutes}
          kilometers={longestKm}
          primary={false}
          label={
            longestKm != null && longestPath?.durationMinutes != null
              ? `${longestKm} km · ~${longestPath.durationMinutes} min`
              : undefined
          }
          variant="longest"
        />
      ) : null}

      {showPrimary && (primaryKm != null || primaryMinutes != null) ? (
        <RouteDurationBadge
          coordinate={labelPointOnPath(primaryCoords, 0.5)}
          minutes={primaryMinutes}
          kilometers={primaryKm}
          primary
        />
      ) : null}
    </>
  );
}
