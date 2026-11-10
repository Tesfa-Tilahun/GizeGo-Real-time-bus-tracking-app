const GPS_SEARCH_RADIUS_METERS = Number(process.env.GPS_SEARCH_RADIUS_METERS ?? 2000);

export class SearchRoutesUseCase {
  constructor(routeRepository, locationAliasResolver) {
    this.routeRepository = routeRepository;
    this.locationAliasResolver = locationAliasResolver;
  }

  async execute(fromQuery, toQuery, opts = {}) {
    const fromLat = Number(opts.fromLat);
    const fromLng = Number(opts.fromLng);
    const hasFromGps = Number.isFinite(fromLat) && Number.isFinite(fromLng);
    const searchRadius = Number(opts.radiusMeters) > 0 ? Number(opts.radiusMeters) : GPS_SEARCH_RADIUS_METERS;

    const toLocation = await this.locationAliasResolver.resolveText(toQuery);
    const fromLocation = hasFromGps
      ? await this.locationAliasResolver.resolveCoordinates(fromLat, fromLng, searchRadius)
      : await this.locationAliasResolver.resolveText(fromQuery);

    const log = {
      userQuery: { from: fromQuery, to: toQuery, fromLat: opts.fromLat, fromLng: opts.fromLng },
      normalizedQuery: {
        from: fromLocation?.match?.normalizedQuery ?? null,
        to: toLocation?.match?.normalizedQuery ?? null,
      },
      matchedAlias: {
        from: fromLocation?.match?.matchedAlias ?? null,
        to: toLocation?.match?.matchedAlias ?? null,
      },
      canonicalLocation: {
        from: fromLocation
          ? { id: fromLocation.id, name: fromLocation.canonicalName, lat: fromLocation.latitude, lng: fromLocation.longitude }
          : null,
        to: toLocation
          ? { id: toLocation.id, name: toLocation.canonicalName, lat: toLocation.latitude, lng: toLocation.longitude }
          : null,
      },
      matchType: {
        from: fromLocation?.match?.type ?? null,
        to: toLocation?.match?.type ?? null,
      },
    };

    let routes = [];
    let status = "ok";
    let message = null;
    if (!fromLocation) {
      status = "departure_unidentified";
      message = "Could not identify departure location.";
    } else if (!toLocation) {
      status = "destination_unidentified";
      message = "Could not identify destination.";
    } else {
      routes = await this.routeRepository.searchSummariesByCanonicalLocations(fromLocation, toLocation, {
        radiusMeters: searchRadius,
        fromGpsLat: hasFromGps ? fromLat : undefined,
        fromGpsLng: hasFromGps ? fromLng : undefined,
      });

      if (routes.length === 0 && hasFromGps) {
        const nearestFrom = await this.routeRepository.findNearestStop(fromLat, fromLng, searchRadius);
        routes = await this.routeRepository.searchSummariesByStops(
          nearestFrom?.name ?? "",
          toLocation.canonicalName,
          { fromLat, fromLng, radiusMeters: searchRadius },
        );
        if (routes.length > 0) {
          log.matchType.from = "gps-nearest-stop-fallback";
          log.matchedAlias.from = nearestFrom?.name ?? fromLocation.match?.matchedAlias ?? null;
        }
      }

      if (routes.length === 0) {
        status = "no_route";
        message = "No route available between selected locations.";
      }
    }

    log.routeSearchResult = { status, message, count: routes.length, routeIds: routes.map((r) => r.id) };
    console.info("[route-search]", JSON.stringify(log));

    return {
      routes,
      meta: {
        from: fromLocation ? publicLocation(fromLocation) : null,
        to: toLocation ? publicLocation(toLocation) : null,
        status,
        message,
        log,
      },
    };
  }
}

function publicLocation(location) {
  return {
    id: location.id,
    canonicalName: location.canonicalName,
    latitude: location.latitude,
    longitude: location.longitude,
    matchedAlias: location.match?.matchedAlias ?? null,
    matchType: location.match?.type ?? null,
    distanceMeters: location.match?.distanceMeters ?? null,
    reverseGeocodeName: location.match?.reverseGeocodeName ?? null,
  };
}
