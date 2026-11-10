import { minutesUntilHHmm } from "../shared/utils/scheduleTime.js";

/**
 * Merges admin schedules, route fare, and live simulated buses for the passenger app.
 */
export class RoutePassengerInfoService {
  constructor(routeRepository, listBusesOnRoute, getLiveBuses, stopEtaService) {
    this.routeRepository = routeRepository;
    this.listBusesOnRoute = listBusesOnRoute;
    this.getLiveBuses = getLiveBuses;
    this.stopEtaService = stopEtaService;
  }

  async execute(routeId) {
    const route = await this.routeRepository.findById(routeId);
    if (!route) return null;

    const scheduled = await this.listBusesOnRoute.execute(routeId);
    const live = this.getLiveBuses(routeId) ?? [];
    const liveByBusId = new Map(live.map((b) => [b.busId, b]));

    const buses = scheduled.map((bus) => {
      const liveBus = liveByBusId.get(bus.id);
      const dep = bus.departureTime;
      const arr = bus.arrivalTime;
      const minutesUntil = dep ? minutesUntilHHmm(dep) : null;

      if (liveBus) {
        return {
          id: bus.id,
          name: bus.name,
          departureStopName: bus.departureStopName,
          arrivalStopName: bus.arrivalStopName,
          departureTime: dep,
          arrivalTime: arr,
          availableNow: true,
          etaMinutes: liveBus.etaMinutes ?? null,
          status: liveBus.status ?? "moving",
          speedKmh: liveBus.speedKmh ?? null,
          minutesUntilDeparture: null,
          scheduleLabel: dep && arr ? `${dep} → ${arr}` : dep ?? null,
        };
      }

      return {
        id: bus.id,
        name: bus.name,
        departureStopName: bus.departureStopName,
        arrivalStopName: bus.arrivalStopName,
        departureTime: dep,
        arrivalTime: arr,
        availableNow: false,
        etaMinutes: null,
        status: null,
        speedKmh: null,
        minutesUntilDeparture: minutesUntil,
        scheduleLabel: dep && arr ? `${dep} → ${arr}` : dep ?? null,
      };
    });

    const stopEtas = await this.stopEtaService.compute(routeId);

    return {
      routeId: route.id,
      routeName: route.name,
      price: route.price,
      distanceMeters: route.distanceMeters,
      liveBusCount: live.length,
      scheduledBusCount: scheduled.length,
      anyBusAvailableNow: live.length > 0,
      buses,
      stopEtas: stopEtas?.stops ?? [],
      traffic: stopEtas?.traffic ?? null,
      updatedAt: new Date().toISOString(),
    };
  }
}
