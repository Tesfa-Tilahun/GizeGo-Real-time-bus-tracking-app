import { z } from "zod";
import { BUS_STATUSES } from "../data/routeCatalog.js";
import { osmRoutingService } from "../services/OsmRoutingService.js";
import { encodePolyline } from "../shared/utils/polyline.js";

/** A geographic point along the route (no sequenceOrder in the wire format). */
const routePointSchema = z.object({
  name: z.string().trim().min(1).max(200),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

const stopInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  sequenceOrder: z.number().int().min(1),
});

function stopsFromDepartureArrival(departure, arrival, waypoints = []) {
  const w = [...waypoints];
  return [
    {
      name: departure.name,
      latitude: departure.latitude,
      longitude: departure.longitude,
      sequenceOrder: 1,
    },
    ...w.map((s, i) => ({
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      sequenceOrder: i + 2,
    })),
    {
      name: arrival.name,
      latitude: arrival.latitude,
      longitude: arrival.longitude,
      sequenceOrder: w.length + 2,
    },
  ];
}

const createRouteSchema = z.object({
  code: z.string().trim().min(1).max(16).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  polyline: z.string().min(1).optional(),
  distanceMeters: z.number().nonnegative().nullable().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  /** Required fare for the route. */
  price: z.number().nonnegative(),
  /** First stop — required name and coordinates. */
  departure: routePointSchema,
  /** Last stop — required name and coordinates. */
  arrival: routePointSchema,
  /** Intermediate stops between departure and arrival (optional). Default []. */
  waypoints: z.array(routePointSchema).default([]),
});

const updateRouteSchema = z
  .object({
    code: z.string().trim().min(1).max(16).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    polyline: z.string().min(1).optional(),
    distanceMeters: z.number().nonnegative().nullable().optional(),
    durationMinutes: z.number().int().nonnegative().optional(),
    price: z.number().nonnegative().optional(),
    departure: routePointSchema.optional(),
    arrival: routePointSchema.optional(),
    /** Replace intermediate stops entirely when rebuilding path (omit or [] clears). */
    waypoints: z.array(routePointSchema).optional(),
    /** Legacy shape: ordered stops including departure → … → arrival. Min 2. */
    stops: z.array(stopInputSchema).min(2).optional(),
  })
  .refine(
    (v) =>
      v.code !== undefined ||
      v.name !== undefined ||
      v.polyline !== undefined ||
      v.distanceMeters !== undefined ||
      v.durationMinutes !== undefined ||
      v.price !== undefined ||
      v.departure !== undefined ||
      v.arrival !== undefined ||
      v.waypoints !== undefined ||
      v.stops !== undefined,
    { message: "At least one field is required", path: ["name"] },
  )
  .superRefine((v, ctx) => {
    const hasTerminals =
      v.departure !== undefined || v.arrival !== undefined || v.waypoints !== undefined;
    const hasLegacyStops = v.stops !== undefined;

    if (hasTerminals && hasLegacyStops) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use departure, arrival, and waypoints—or stops—not both.",
        path: ["stops"],
      });
      return;
    }

    if (hasTerminals) {
      if (v.departure === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "departure is required when updating route path terminals",
          path: ["departure"],
        });
      }
      if (v.arrival === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "arrival is required when updating route path terminals",
          path: ["arrival"],
        });
      }
    }
  });

const assignBusSchema = z
  .object({
    busId: z.string().trim().min(1).optional(),
    newBusName: z.string().trim().min(1).max(120).optional(),
  })
  .refine((x) => Boolean(x.busId) !== Boolean(x.newBusName), {
    message: "Provide exactly one of busId or newBusName",
    path: ["busId"],
  });

const updateBusAssignmentSchema = z.object({}).optional();

const createBusSchema = z.object({
  name: z.string().trim().min(1).max(120),
  operator: z.string().trim().min(1).max(32).optional(),
  status: z.enum(BUS_STATUSES).optional(),
  /** Assign to an existing route in the same request (uses the route map stops). */
  routeId: z.string().trim().min(1).optional(),
});

const updateBusEntitySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    operator: z.string().trim().min(1).max(32).nullable().optional(),
    status: z.enum(BUS_STATUSES).optional(),
  })
  .refine((v) => v.name !== undefined || v.operator !== undefined || v.status !== undefined, {
    message: "At least one field is required",
    path: ["name"],
  });

export class RouteManagementController {
  constructor(
    listRouteSummaries,
    getRouteById,
    createRouteUseCase,
    updateRouteUseCase,
    deleteRouteUseCase,
    listBusesOnRouteUseCase,
    assignBusToRouteUseCase,
    unassignBusFromRouteUseCase,
    createBusUseCase,
    listBusesUseCase,
    updateBusAssignmentUseCase,
    getBusByIdUseCase,
    updateBusUseCase,
    deleteBusUseCase,
  ) {
    this.listRouteSummaries = listRouteSummaries;
    this.getRouteById = getRouteById;
    this.createRouteUseCase = createRouteUseCase;
    this.updateRouteUseCase = updateRouteUseCase;
    this.deleteRouteUseCase = deleteRouteUseCase;
    this.listBusesOnRouteUseCase = listBusesOnRouteUseCase;
    this.assignBusToRouteUseCase = assignBusToRouteUseCase;
    this.unassignBusFromRouteUseCase = unassignBusFromRouteUseCase;
    this.createBusUseCase = createBusUseCase;
    this.listBusesUseCase = listBusesUseCase;
    this.updateBusAssignmentUseCase = updateBusAssignmentUseCase;
    this.getBusByIdUseCase = getBusByIdUseCase;
    this.updateBusUseCase = updateBusUseCase;
    this.deleteBusUseCase = deleteBusUseCase;
  }

  listRoutes = async (_req, res) => {
    const rows = await this.listRouteSummaries.execute();
    res.status(200).json({ routes: rows.map(toPublicSummary) });
  };

  getRoute = async (req, res) => {
    const routeId = String(req.params.routeId);
    const route = await this.getRouteById.execute(routeId);
    const buses = await this.listBusesOnRouteUseCase.execute(routeId);
    res.status(200).json({
      route: toPublicRouteWithStops(route),
      buses: buses.map(toPublicBus),
    });
  };

  createRoute = async (req, res) => {
    const body = createRouteSchema.parse(req.body);
    const stops = stopsFromDepartureArrival(body.departure, body.arrival, body.waypoints ?? []);
    const name = body.name ?? `${body.departure.name} -> ${body.arrival.name}`;
    let polyline = body.polyline;
    let distanceMeters = body.distanceMeters ?? null;
    let osmSource = "client";
    if (!polyline) {
      polyline = encodePolyline(stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })));
    }
    try {
      const osm = await osmRoutingService.routeThroughStops(stops);
      polyline = osm.polyline;
      distanceMeters = osm.distanceMeters ?? distanceMeters;
      osmSource = osm.source;
    } catch {
      /* keep client-supplied or encoded geometry */
    }
    const created = await this.createRouteUseCase.execute({
      code: body.code,
      name,
      polyline,
      distanceMeters,
      durationMinutes: body.durationMinutes,
      price: body.price,
      stops,
    });
    res.status(201).json({ route: toPublicRouteWithStops(created), osmSource });
  };

  updateRoute = async (req, res) => {
    const body = updateRouteSchema.parse(req.body);

    let resolvedStops;
    if (
      body.departure !== undefined ||
      body.arrival !== undefined ||
      body.waypoints !== undefined
    ) {
      resolvedStops = stopsFromDepartureArrival(body.departure, body.arrival, body.waypoints ?? []);
    } else if (body.stops !== undefined) {
      resolvedStops = body.stops.map((s) => ({
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        sequenceOrder: s.sequenceOrder,
      }));
    }

    let name = body.name;
    let polyline = body.polyline;
    let distanceMeters = body.distanceMeters;

    if (resolvedStops) {
      if (name === undefined && body.departure && body.arrival) {
        name = `${body.departure.name} -> ${body.arrival.name}`;
      }
      if (polyline === undefined) {
        polyline = encodePolyline(
          resolvedStops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
        );
      }
      if (distanceMeters === undefined) {
        try {
          const osm = await osmRoutingService.routeThroughStops(resolvedStops);
          polyline = osm.polyline;
          distanceMeters = osm.distanceMeters ?? distanceMeters;
        } catch {
          /* keep encoded polyline */
        }
      }
    }

    const updated = await this.updateRouteUseCase.execute(String(req.params.routeId), {
      code: body.code,
      name,
      polyline,
      distanceMeters,
      durationMinutes: body.durationMinutes,
      price: body.price,
      stops: resolvedStops,
    });
    res.status(200).json({ route: toPublicRouteWithStops(updated) });
  };

  removeRoute = async (req, res) => {
    await this.deleteRouteUseCase.execute(String(req.params.routeId));
    res.status(204).send();
  };

  listRouteBuses = async (req, res) => {
    const buses = await this.listBusesOnRouteUseCase.execute(String(req.params.routeId));
    res.status(200).json({ buses: buses.map(toPublicBus) });
  };

  assignBus = async (req, res) => {
    const body = assignBusSchema.parse(req.body);
    const routeId = String(req.params.routeId);
    let busId = body.busId;
    if (body.newBusName) {
      const created = await this.createBusUseCase.execute({ name: body.newBusName });
      busId = created.id;
    }
    await this.assignBusToRouteUseCase.execute(routeId, busId, {});
    res.status(204).send();
  };

  updateBusAssignment = async (req, res) => {
    updateBusAssignmentSchema.parse(req.body ?? {});
    await this.updateBusAssignmentUseCase.execute(
      String(req.params.routeId),
      String(req.params.busId),
      {},
    );
    res.status(204).send();
  };

  unassignBus = async (req, res) => {
    await this.unassignBusFromRouteUseCase.execute(
      String(req.params.routeId),
      String(req.params.busId),
    );
    res.status(204).send();
  };

  listAllBuses = async (_req, res) => {
    const buses = await this.listBusesUseCase.execute();
    res.status(200).json({ buses: buses.map(toPublicBus) });
  };

  createBus = async (req, res) => {
    const body = createBusSchema.parse(req.body);
    const bus = await this.createBusUseCase.execute({
      name: body.name,
      operator: body.operator,
      status: body.status,
    });

    if (body.routeId) {
      try {
        await this.assignBusToRouteUseCase.execute(body.routeId, bus.id, {});
      } catch (e) {
        try {
          await this.deleteBusUseCase.execute(bus.id);
        } catch (_rollback) {
          /* best-effort cleanup */
        }
        throw e;
      }
    }

    const detail = await this.getBusByIdUseCase.execute(bus.id);
    res.status(201).json({ bus: toPublicBusDetail(detail.bus, detail.assignments) });
  };

  getBusEntity = async (req, res) => {
    const { bus, assignments } = await this.getBusByIdUseCase.execute(String(req.params.busId));
    res.status(200).json({ bus: toPublicBusDetail(bus, assignments) });
  };

  updateBusEntity = async (req, res) => {
    const body = updateBusEntitySchema.parse(req.body);
    const bus = await this.updateBusUseCase.execute(String(req.params.busId), body);
    res.status(200).json({ bus: toPublicBus(bus) });
  };

  deleteBusEntity = async (req, res) => {
    await this.deleteBusUseCase.execute(String(req.params.busId));
    res.status(204).send();
  };
}

function toPublicSummary(s) {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    distanceMeters: s.distanceMeters,
    durationMinutes: s.durationMinutes,
    price: s.price,
    stopCount: s.stopCount,
    busCount: s.busCount ?? 0,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function toPublicRouteWithStops(r) {
  const ordered = [...r.stops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const dep = ordered[0];
  const arr = ordered.length >= 2 ? ordered[ordered.length - 1] : undefined;
  const middle = ordered.length > 2 ? ordered.slice(1, -1) : [];
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    polyline: r.polyline,
    distanceMeters: r.distanceMeters,
    durationMinutes: r.durationMinutes,
    price: r.price,
    stops: ordered.map(toPublicStop),
    departure: dep ? toPublicTerminal(dep) : undefined,
    arrival: arr ? toPublicTerminal(arr) : undefined,
    waypoints: middle.map(toPublicTerminal),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toPublicTerminal(s) {
  return {
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
  };
}

function toPublicStop(s) {
  return {
    id: s.id,
    name: s.name,
    sequenceOrder: s.sequenceOrder,
    latitude: s.latitude,
    longitude: s.longitude,
  };
}

function toPublicBusDetail(bus, assignments) {
  return {
    id: bus.id,
    name: bus.name,
    operator: bus.operator,
    status: bus.status ?? "active",
    createdAt: bus.createdAt.toISOString(),
    routeAssignments: assignments.map(toPublicRouteAssignment),
  };
}

function toPublicBus(b) {
  const o = {
    id: b.id,
    name: b.name,
    status: b.status ?? "active",
    createdAt: b.createdAt.toISOString(),
  };
  if (b.operator) o.operator = b.operator;
  if (b.driverId) o.driverId = b.driverId;
  if (b.driver) o.driver = b.driver;
  if (typeof b.routeAssignmentsCount === "number") o.routeAssignmentsCount = b.routeAssignmentsCount;
  if (b.departureStopId != null) o.departureStopId = b.departureStopId;
  if (b.arrivalStopId != null) o.arrivalStopId = b.arrivalStopId;
  if (b.departureStopName != null) o.departureStopName = b.departureStopName;
  if (b.arrivalStopName != null) o.arrivalStopName = b.arrivalStopName;
  if (b.departureTime != null) o.departureTime = b.departureTime;
  if (b.arrivalTime != null) o.arrivalTime = b.arrivalTime;
  return o;
}

function toPublicRouteAssignment(a) {
  return {
    routeId: a.routeId,
    routeName: a.routeName,
    departureStopId: a.departureStopId,
    arrivalStopId: a.arrivalStopId,
    departureStopName: a.departureStopName,
    arrivalStopName: a.arrivalStopName,
    departureTime: a.departureTime,
    arrivalTime: a.arrivalTime,
    assignedAt: a.assignedAt.toISOString(),
  };
}
