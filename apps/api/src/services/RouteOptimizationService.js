import { aStarShortestPath } from "../shared/algorithms/aStar.js";
import {
  decodePolyline,
  pathTotalMeters,
  simplifyPath,
} from "../shared/utils/polyline.js";
import { trafficSimulation } from "./TrafficSimulationService.js";
import { osmRoutingService } from "./OsmRoutingService.js";
import { routeDebug } from "../shared/utils/routeDebug.js";

function haversineMeters(a, b) {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function nearestIndexOnPath(coords, point) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineMeters(coords[i], point);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function nearestStop(stops, point) {
  let best = stops[0];
  let bestD = Infinity;
  for (const s of stops) {
    const d = haversineMeters(s, point);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function nearestNodeId(nodes, point) {
  let best = nodes[0]?.id;
  let bestD = Infinity;
  for (const n of nodes) {
    const d = haversineMeters(n, point);
    if (d < bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return best;
}

/** Force every path option to start/end at the same departure & arrival. */
function anchorPathEndpoints(coords, startPoint, endPoint) {
  if (!coords?.length) return [];
  if (coords.length === 1) {
    return [
      { latitude: Number(startPoint.latitude), longitude: Number(startPoint.longitude) },
      { latitude: Number(endPoint.latitude), longitude: Number(endPoint.longitude) },
    ];
  }
  const out = coords.map((c) => ({
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
  }));
  out[0] = { latitude: Number(startPoint.latitude), longitude: Number(startPoint.longitude) };
  out[out.length - 1] = {
    latitude: Number(endPoint.latitude),
    longitude: Number(endPoint.longitude),
  };
  return out;
}

/** Follow the stored route polyline between two trip endpoints (direction-aware). */
function sliceRouteSegment(fullCoords, startPoint, endPoint, { forward = true } = {}) {
  if (fullCoords.length < 2) return [];
  const i0 = nearestIndexOnPath(fullCoords, startPoint);
  const i1 = nearestIndexOnPath(fullCoords, endPoint);
  const lo = Math.min(i0, i1);
  const hi = Math.max(i0, i1);
  if (lo === hi) {
    const nextIdx = forward
      ? Math.min(hi + 1, fullCoords.length - 1)
      : Math.max(hi - 1, 0);
    const pts = forward
      ? [fullCoords[lo], fullCoords[nextIdx]]
      : [fullCoords[lo], fullCoords[nextIdx]];
    return anchorPathEndpoints(pts, startPoint, endPoint);
  }
  let slice = fullCoords.slice(lo, hi + 1);
  if (!forward) slice = [...slice].reverse();
  return anchorPathEndpoints(slice, startPoint, endPoint);
}

function resolveTravelForward(stops, startPoint, endPoint, fromStopId, toStopId) {
  if (fromStopId && toStopId) {
    const depIdx = stops.findIndex((s) => s.id === fromStopId);
    const arrIdx = stops.findIndex((s) => s.id === toStopId);
    if (depIdx >= 0 && arrIdx >= 0) return depIdx < arrIdx;
  }
  const startStop = nearestStop(stops, startPoint);
  const endStop = nearestStop(stops, endPoint);
  const depIdx = stops.findIndex((s) => s.id === startStop.id);
  const arrIdx = stops.findIndex((s) => s.id === endStop.id);
  if (depIdx >= 0 && arrIdx >= 0) return depIdx < arrIdx;
  return true;
}

function routeServesEndpoints(stops, startPoint, endPoint, radiusM = 1200) {
  const nearStart = stops.some((s) => haversineMeters(s, startPoint) <= radiusM);
  const nearEnd = stops.some((s) => haversineMeters(s, endPoint) <= radiusM);
  return nearStart && nearEnd;
}

function buildGraph(coords, trafficFactor) {
  const simplified = simplifyPath(coords, 80);
  const nodes = simplified.map((c, i) => ({
    id: String(i),
    latitude: c.latitude,
    longitude: c.longitude,
  }));
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const w = haversineMeters(nodes[i], nodes[i + 1]) * trafficFactor;
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id, weight: w });
  }
  return { nodes, edges, simplified };
}

function pathIdsToCoords(nodes, pathIds) {
  return pathIds.map((id) => {
    const n = nodes.find((x) => x.id === id);
    return { latitude: n.latitude, longitude: n.longitude };
  });
}

function samePathIds(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

function buildPathRecord({ coordinates, routeId, name, speedMps, reason }) {
  const distanceMeters = pathTotalMeters(coordinates);
  return {
    routeId,
    name,
    coordinates,
    distanceMeters,
    durationMinutes: Math.max(1, Math.round(distanceMeters / speedMps / 60)),
    reason,
  };
}

function samplePath(coords, samples = 5) {
  if (!coords?.length) return [];
  if (coords.length <= samples) return coords;
  const out = [];
  for (let i = 0; i < samples; i++) {
    const idx = Math.round((i / (samples - 1)) * (coords.length - 1));
    out.push(coords[idx]);
  }
  return out;
}

function pathsTooSimilar(a, b, thresholdMeters = 120) {
  if (!a?.coordinates?.length || !b?.coordinates?.length) return true;
  const distDiff = Math.abs(a.distanceMeters - b.distanceMeters);
  const avgDist = (a.distanceMeters + b.distanceMeters) / 2 || 1;
  if (distDiff < thresholdMeters) return true;
  // Clearly different length → different option (e.g. bus line vs driving roads).
  if (distDiff / avgDist > 0.12) return false;

  const aSamples = samplePath(a.coordinates);
  const bSamples = samplePath(b.coordinates);
  let close = 0;
  for (const p of aSamples) {
    const minD = Math.min(...bSamples.map((q) => haversineMeters(p, q)));
    if (minD < 80) close += 1;
  }
  return close >= Math.max(2, Math.floor(aSamples.length * 0.6));
}

/** Second-shortest style path by skipping one segment on the same road graph. */
function findDetourPaths(
  nodes,
  edges,
  startId,
  goalId,
  primaryPathIds,
  routeId,
  routeName,
  speedMps,
  startPoint,
  endPoint,
) {
  if (primaryPathIds.length < 4) return [];
  const out = [];
  const trySkip = (skipIdx) => {
    const skipFrom = primaryPathIds[skipIdx - 1];
    const skipTo = primaryPathIds[skipIdx];
    const filtered = edges.filter((e) => !(e.from === skipFrom && e.to === skipTo));
    const altIds = aStarShortestPath(nodes, filtered, startId, goalId);
    if (!altIds?.length || samePathIds(altIds, primaryPathIds)) return null;
    if (out.some((a) => samePathIds(a.pathIds, altIds))) return null;
    const pathCoords = anchorPathEndpoints(
      pathIdsToCoords(nodes, altIds),
      startPoint,
      endPoint,
    );
    const distanceMeters = pathTotalMeters(pathCoords);
    return {
      pathIds: altIds,
      routeId: `${routeId}-detour-${skipIdx}`,
      name: routeName,
      coordinates: pathCoords,
      distanceMeters,
      durationMinutes: Math.max(1, Math.round(distanceMeters / speedMps / 60)),
      reason: "alternate_path",
    };
  };

  const mid = Math.floor(primaryPathIds.length / 2);
  for (const idx of [mid, mid + 1, mid - 1, 2, 3, primaryPathIds.length - 2]) {
    if (idx < 2 || idx >= primaryPathIds.length) continue;
    const alt = trySkip(idx);
    if (alt) out.push(alt);
    if (out.length >= 3) break;
  }
  return out.map(({ pathIds, ...rest }) => rest);
}

function rankPathOptions(candidates, speedMps, routeId, routeName) {
  const unique = [];
  for (const c of candidates) {
    if (!c?.coordinates || c.coordinates.length < 2) continue;
    const normalized = buildPathRecord({
      coordinates: c.coordinates,
      routeId: c.routeId ?? routeId,
      name: c.name ?? routeName,
      speedMps,
      reason: c.reason ?? "path",
    });
    if (unique.some((u) => pathsTooSimilar(u, normalized))) continue;
    unique.push(normalized);
  }
  unique.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return unique;
}

function splitRankedPaths(ranked) {
  if (!ranked.length) return { shortest: null, longest: null, alternatives: [] };
  const shortest = { ...ranked[0], pathRole: "shortest" };
  if (ranked.length === 1) {
    return { shortest, longest: null, alternatives: [] };
  }
  const last = ranked[ranked.length - 1];
  const minGapMeters = 150;
  if (ranked.length >= 2 && last.distanceMeters - shortest.distanceMeters >= minGapMeters) {
    const longest = { ...last, pathRole: "longest" };
    const alternatives = ranked.slice(1, -1).map((p) => ({ ...p, pathRole: "alternative" }));
    return { shortest, longest, alternatives };
  }
  return {
    shortest,
    longest: null,
    alternatives: ranked.slice(1).map((p) => ({ ...p, pathRole: "alternative" })),
  };
}

export class RouteOptimizationService {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async findCatalogAlternatives(currentRouteId, startPoint, endPoint, speedMps) {
    const summaries = await this.routeRepository.listSummaries();
    const alts = [];
    for (const s of summaries) {
      if (s.id === currentRouteId || alts.length >= 3) continue;
      const full = await this.routeRepository.findById(s.id);
      if (!full?.stops?.length) continue;
      const stops = [...full.stops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      if (!routeServesEndpoints(stops, startPoint, endPoint)) continue;

      const startStop = nearestStop(stops, startPoint);
      const endStop = nearestStop(stops, endPoint);
      const depIdx = stops.findIndex((x) => x.id === startStop.id);
      const arrIdx = stops.findIndex((x) => x.id === endStop.id);
      if (depIdx < 0 || arrIdx < 0 || depIdx === arrIdx || depIdx >= arrIdx) continue;

      const segStart = startStop;
      const segEnd = endStop;
      const coords = decodePolyline(full.polyline);
      if (coords.length < 2) continue;

      const segment = sliceRouteSegment(coords, segStart, segEnd, { forward: true });
      if (segment.length < 2) continue;

      alts.push(
        buildPathRecord({
          coordinates: anchorPathEndpoints(segment, startPoint, endPoint),
          routeId: s.id,
          name: s.name,
          speedMps,
          reason: "alternative_route",
        }),
      );
    }
    return alts;
  }

  async findOsmAlternatives(startPoint, endPoint, routeId, routeName, speedMps) {
    const out = [];
    const start = { latitude: Number(startPoint.latitude), longitude: Number(startPoint.longitude) };
    const end = { latitude: Number(endPoint.latitude), longitude: Number(endPoint.longitude) };

    try {
      const routes = await osmRoutingService.routeAlternatives([start, end], 3);
      routes.forEach((r, index) => {
        out.push(
          buildPathRecord({
            coordinates: anchorPathEndpoints(r.coordinates, startPoint, endPoint),
            routeId: `${routeId}-osm-${index}`,
            name: routeName,
            speedMps,
            reason: "osm_alternate",
          }),
        );
      });
    } catch {
      /* try direct + detour below */
    }

    try {
      const direct = await osmRoutingService.routeThroughWaypoints([start, end]);
      out.push(
        buildPathRecord({
          coordinates: anchorPathEndpoints(direct.coordinates, startPoint, endPoint),
          routeId: `${routeId}-osm-drive`,
          name: routeName,
          speedMps,
          reason: "osm_alternate",
        }),
      );
    } catch {
      /* ignore */
    }

    try {
      const mid = {
        latitude: (start.latitude + end.latitude) / 2 + 0.003,
        longitude: (start.longitude + end.longitude) / 2 + 0.003,
      };
      const detour = await osmRoutingService.routeThroughWaypoints([start, mid, end]);
      out.push(
        buildPathRecord({
          coordinates: anchorPathEndpoints(detour.coordinates, startPoint, endPoint),
          routeId: `${routeId}-osm-detour`,
          name: routeName,
          speedMps,
          reason: "osm_detour",
        }),
      );
    } catch {
      /* ignore */
    }

    return out;
  }

  async findViaStopAlternative(stops, startPoint, endPoint, routeId, routeName, speedMps) {
    const ordered = [...stops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const depIdx = ordered.findIndex((s) => s.id === nearestStop(ordered, startPoint).id);
    const arrIdx = ordered.findIndex((s) => s.id === nearestStop(ordered, endPoint).id);
    if (depIdx < 0 || arrIdx < 0) return null;
    const lo = Math.min(depIdx, arrIdx);
    const hi = Math.max(depIdx, arrIdx);
    if (hi - lo < 2) return null;
    const viaStop = ordered[Math.floor((lo + hi) / 2)];
    try {
      const routed = await osmRoutingService.routeThroughWaypoints([
        { latitude: startPoint.latitude, longitude: startPoint.longitude },
        { latitude: viaStop.latitude, longitude: viaStop.longitude },
        { latitude: endPoint.latitude, longitude: endPoint.longitude },
      ]);
      return buildPathRecord({
        coordinates: anchorPathEndpoints(routed.coordinates, startPoint, endPoint),
        routeId: `${routeId}-via-${viaStop.id ?? "mid"}`,
        name: routeName,
        speedMps,
        reason: "via_stop",
      });
    } catch {
      return null;
    }
  }

  async optimize(routeId, { fromStopId, toStopId, fromLat, fromLng, toLat, toLng }) {
    const route = await this.routeRepository.findById(routeId);
    if (!route) return null;

    trafficSimulation.ensureRoute(routeId);
    const traffic = trafficSimulation.get(routeId);
    const coords = decodePolyline(route.polyline);
    if (coords.length < 2) return null;

    const stops = [...route.stops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    let startPoint = stops[0];
    let endPoint = stops[stops.length - 1];

    if (fromStopId) {
      const s = stops.find((x) => x.id === fromStopId);
      if (s) startPoint = s;
    } else if (fromLat != null && fromLng != null) {
      startPoint = { latitude: fromLat, longitude: fromLng };
    }
    if (toStopId) {
      const s = stops.find((x) => x.id === toStopId);
      if (s) endPoint = s;
    } else if (toLat != null && toLng != null) {
      endPoint = { latitude: toLat, longitude: toLng };
    }

    const speedMps = trafficSimulation.effectiveSpeedMps(routeId);
    const travelForward = resolveTravelForward(
      stops,
      startPoint,
      endPoint,
      fromStopId,
      toStopId,
    );
    const slicePath = sliceRouteSegment(coords, startPoint, endPoint, { forward: travelForward });
    const graphCoords = slicePath.length > 1 ? slicePath : coords;
    const { nodes, edges } = buildGraph(graphCoords, traffic.factor);
    const startId = nearestNodeId(nodes, startPoint);
    const goalId = nearestNodeId(nodes, endPoint);
    const pathIds = aStarShortestPath(nodes, edges, startId, goalId);

    const candidates = [];
    if (slicePath.length > 1) {
      candidates.push({
        coordinates: slicePath,
        routeId,
        name: route.name,
        reason: "route_slice",
      });
    }

    if (pathIds?.length) {
      const astarCoords = anchorPathEndpoints(
        pathIds.map((id) => {
          const n = nodes.find((x) => x.id === id);
          return { latitude: n.latitude, longitude: n.longitude };
        }),
        startPoint,
        endPoint,
      );
      candidates.push({
        coordinates: astarCoords,
        routeId: `${routeId}-astar`,
        name: route.name,
        reason: "a_star",
      });

      candidates.push(
        ...findDetourPaths(
          nodes,
          edges,
          startId,
          goalId,
          pathIds,
          routeId,
          route.name,
          speedMps,
          startPoint,
          endPoint,
        ).map((d) => ({
          coordinates: d.coordinates,
          routeId: d.routeId,
          name: d.name,
          reason: d.reason,
        })),
      );
    }

    candidates.push(
      ...(await this.findCatalogAlternatives(routeId, startPoint, endPoint, speedMps)).map((d) => ({
        coordinates: d.coordinates,
        routeId: d.routeId,
        name: d.name,
        reason: d.reason,
      })),
    );
    candidates.push(
      ...(await this.findOsmAlternatives(startPoint, endPoint, routeId, route.name, speedMps)).map((d) => ({
        coordinates: d.coordinates,
        routeId: d.routeId,
        name: d.name,
        reason: d.reason,
      })),
    );

    let ranked = rankPathOptions(candidates, speedMps, routeId, route.name);

    if (ranked.length < 3) {
      const viaPath = await this.findViaStopAlternative(
        stops,
        startPoint,
        endPoint,
        routeId,
        route.name,
        speedMps,
      );
      if (viaPath) {
        ranked = rankPathOptions(
          [...ranked.map((r) => ({ coordinates: r.coordinates, routeId: r.routeId, name: r.name, reason: r.reason })), {
            coordinates: viaPath.coordinates,
            routeId: viaPath.routeId,
            name: viaPath.name,
            reason: viaPath.reason,
          }],
          speedMps,
          routeId,
          route.name,
        );
      }
    }

    if (!ranked.length) return null;

    const { shortest, longest, alternatives } = splitRankedPaths(ranked);

    routeDebug("optimize", {
      routeId,
      from: { lat: startPoint.latitude, lng: startPoint.longitude },
      to: { lat: endPoint.latitude, lng: endPoint.longitude },
      shortestKm: Math.round((shortest.distanceMeters / 1000) * 10) / 10,
      longestKm: longest ? Math.round((longest.distanceMeters / 1000) * 10) / 10 : null,
      altCount: alternatives.length,
      pathCount: ranked.length,
    });

    return {
      algorithm: "a-star",
      traffic,
      primary: {
        routeId,
        name: route.name,
        coordinates: shortest.coordinates,
        distanceMeters: shortest.distanceMeters,
        durationMinutes: shortest.durationMinutes,
        stopCount: stops.length,
        pathRole: "shortest",
      },
      longest: longest
        ? {
            routeId: longest.routeId,
            name: route.name,
            coordinates: longest.coordinates,
            distanceMeters: longest.distanceMeters,
            durationMinutes: longest.durationMinutes,
            pathRole: "longest",
          }
        : null,
      alternatives: alternatives.slice(0, 5).map((a) => ({
        routeId: a.routeId,
        name: a.name ?? route.name,
        coordinates: a.coordinates,
        distanceMeters: a.distanceMeters,
        durationMinutes: a.durationMinutes,
        pathRole: "alternative",
        reason: a.reason,
      })),
      allPaths: ranked.map((p, i) => ({
        rank: i + 1,
        routeId: p.routeId,
        distanceMeters: p.distanceMeters,
        durationMinutes: p.durationMinutes,
        reason: p.reason,
      })),
      recalculatedAt: new Date().toISOString(),
    };
  }
}
