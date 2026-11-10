import { nominatimGeocoding } from "../services/NominatimGeocodingService.js";

function toPublicPoi(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    latitude: p.latitude,
    longitude: p.longitude,
  };
}

function toPublicRouteWithStops(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    polyline: r.polyline,
    distanceMeters: r.distanceMeters,
    price: r.price,
    stops: r.stops.map((s) => ({
      id: s.id,
      name: s.name,
      sequenceOrder: s.sequenceOrder,
      latitude: s.latitude,
      longitude: s.longitude,
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export class MapController {
  constructor(
    listMapPoisUseCase,
    getRecommendedRouteUseCase,
    mapPlacesSearchUseCase,
    getRouteByIdUseCase,
    locationAliasResolver = null,
  ) {
    this.listMapPoisUseCase = listMapPoisUseCase;
    this.getRecommendedRouteUseCase = getRecommendedRouteUseCase;
    this.mapPlacesSearchUseCase = mapPlacesSearchUseCase;
    this.getRouteByIdUseCase = getRouteByIdUseCase;
    this.locationAliasResolver = locationAliasResolver;
  }

  listPois = async (req, res) => {
    const q = String(req.query.q ?? "").trim() || undefined;
    const pois = await this.listMapPoisUseCase.execute(q);
    res.status(200).json({ pois: pois.map(toPublicPoi) });
  };

  recommendedRoute = async (_req, res) => {
    const { route, message } = await this.getRecommendedRouteUseCase.execute();
    res.status(200).json({
      message,
      route: toPublicRouteWithStops(route),
    });
  };

  searchPlaces = async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const result = await this.mapPlacesSearchUseCase.execute(q);
    res.status(200).json(result);
  };

  geocodeEthiopia = async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const places = await nominatimGeocoding.searchEthiopia(q, 10);
    res.status(200).json({ places, country: "ET", mapProvider: "openstreetmap" });
  };

  reverseGeocode = async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(422).json({ message: "lat and lng query params required" });
      return;
    }
    const place = await nominatimGeocoding.reverseGeocode(lat, lng);
    const canonicalLocation = this.locationAliasResolver
      ? await this.locationAliasResolver.resolveCoordinates(lat, lng).catch(() => null)
      : null;
    res.status(200).json({ place, canonicalLocation, country: "ET" });
  };

  routeStops = async (req, res) => {
    const route = await this.getRouteByIdUseCase.execute(String(req.params.routeId));
    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }
    res.status(200).json({
      routeId: route.id,
      name: route.name,
      polyline: route.polyline,
      distanceMeters: route.distanceMeters,
      price: route.price,
      stops: route.stops.map((s) => ({
        id: s.id,
        name: s.name,
        sequenceOrder: s.sequenceOrder,
        latitude: s.latitude,
        longitude: s.longitude,
      })),
    });
  };
}
