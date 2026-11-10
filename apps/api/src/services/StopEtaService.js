import {
  decodePolyline,
  pathTotalMeters,
  progressAtNearestPoint,
} from "../shared/utils/polyline.js";
import { trafficSimulation } from "./TrafficSimulationService.js";
import { routeDebug } from "../shared/utils/routeDebug.js";

const BASE_SPEED_MPS = 8.5;

/** FR6: dynamic ETAs per stop from live bus positions along route geometry. */
export class StopEtaService {
  constructor(routeRepository, getLiveBuses) {
    this.routeRepository = routeRepository;
    this.getLiveBuses = getLiveBuses;
  }

  async compute(routeId) {
    const route = await this.routeRepository.findById(routeId);
    if (!route) return null;

    const stops = [...route.stops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const liveBuses = this.getLiveBuses(routeId) ?? [];
    const coords = decodePolyline(route.polyline);
    const pathMeters = pathTotalMeters(coords);
    const stopProgress = stops.map((stop) => ({
      stop,
      progress: coords.length > 1 ? progressAtNearestPoint(coords, stop) : 0,
    }));

    const stopEtas = stopProgress.map(({ stop, progress: stopProg }) => {
      let bestEta = null;
      let bestBus = null;
      let bestDist = null;
      for (const bus of liveBuses) {
        const busProg = bus.progress ?? 0;
        if (stopProg <= busProg + 0.002) continue;
        const total = bus.totalMeters ?? (pathMeters || 1);
        const remainingAlong = (stopProg - busProg) * total;
        const speed = bus.speedMps > 0 ? bus.speedMps : BASE_SPEED_MPS;
        const etaMin = Math.max(0, Math.round(remainingAlong / speed / 60));
        if (bestEta == null || etaMin < bestEta) {
          bestEta = etaMin;
          bestBus = bus.busName;
          bestDist = Math.round(remainingAlong);
        }
      }
      return {
        stopId: stop.id,
        stopName: stop.name,
        sequenceOrder: stop.sequenceOrder,
        latitude: stop.latitude,
        longitude: stop.longitude,
        etaMinutes: bestEta,
        nearestBus: bestBus,
        distanceToStopMeters: bestDist,
      };
    });

    routeDebug("stop-etas", {
      routeId,
      stopCount: stops.length,
      liveBusCount: liveBuses.length,
      sample: stopEtas.slice(0, 3).map((s) => ({ name: s.stopName, eta: s.etaMinutes })),
    });

    return {
      routeId,
      traffic: trafficSimulation.get(routeId),
      updatedAt: new Date().toISOString(),
      stops: stopEtas,
    };
  }
}
