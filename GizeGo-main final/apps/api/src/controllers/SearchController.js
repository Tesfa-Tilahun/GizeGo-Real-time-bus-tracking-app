import { AppError } from "../shared/errors/AppError.js";

function toPublicRouteSummary(s) {
  return {
    id: s.id,
    name: s.name,
    distanceMeters: s.distanceMeters,
    price: s.price,
    stopCount: s.stopCount,
    busCount: s.busCount ?? 0,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function toPublicLocation(location) {
  return {
    id: location.id,
    canonicalName: location.canonicalName,
    latitude: location.latitude,
    longitude: location.longitude,
    matchedAlias: location.matchedAlias ?? null,
    matchType: location.matchType ?? null,
    distanceMeters: location.distanceMeters ?? null,
    reverseGeocodeName: location.reverseGeocodeName ?? null,
  };
}

export class SearchController {
  constructor(searchRoutesUseCase, locationAliasResolver = null) {
    this.searchRoutesUseCase = searchRoutesUseCase;
    this.locationAliasResolver = locationAliasResolver;
  }

  searchRoutes = async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const fromLat = Number(req.query.fromLat);
    const fromLng = Number(req.query.fromLng);
    const hasFromCoords = Number.isFinite(fromLat) && Number.isFinite(fromLng);
    if (!to) {
      throw new AppError("Arrival location is required", 422);
    }
    if (!from && !hasFromCoords) {
      throw new AppError(
        "Departure is required (place name or fromLat/fromLng for current location)",
        422,
      );
    }
    const result = await this.searchRoutesUseCase.execute(from, to, {
      fromLat: hasFromCoords ? fromLat : undefined,
      fromLng: hasFromCoords ? fromLng : undefined,
    });
    res.status(200).json({
      routes: result.routes.map(toPublicRouteSummary),
      searchMeta: result.meta,
    });
  };

  searchLocations = async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q || q.length < 1) {
      res.status(200).json({ locations: [] });
      return;
    }
    const locations = this.locationAliasResolver
      ? await this.locationAliasResolver.suggest(q, 10)
      : [];
    res.status(200).json({
      locations: locations.map(toPublicLocation),
      suggestions: locations.map((l) => l.canonicalName),
    });
  };
}
