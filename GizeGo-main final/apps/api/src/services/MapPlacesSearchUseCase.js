import { nominatimGeocoding } from "./NominatimGeocodingService.js";

export class MapPlacesSearchUseCase {
  constructor(routeRepository, poiRepository, locationAliasResolver = null) {
    this.routeRepository = routeRepository;
    this.poiRepository = poiRepository;
    this.locationAliasResolver = locationAliasResolver;
  }

  async execute(q) {
    if (!q?.trim()) {
      return { suggestions: [], places: [] };
    }

    const [canonical, stops, pois, osmPlaces] = await Promise.all([
      this.locationAliasResolver?.resolveText(q).catch(() => null),
      this.routeRepository.searchStopNameSuggestions(q, 10),
      this.poiRepository.searchNameSuggestions(q, 8),
      nominatimGeocoding.searchEthiopia(q, 8).catch(() => []),
    ]);

    const seen = new Set();
    const suggestions = [];
    const places = [];

    if (canonical?.canonicalName && !seen.has(canonical.canonicalName)) {
      seen.add(canonical.canonicalName);
      suggestions.push(canonical.canonicalName);
      places.push({
        id: canonical.id,
        name: canonical.canonicalName,
        fullName: canonical.canonicalName,
        latitude: canonical.latitude,
        longitude: canonical.longitude,
        source: `canonical-${canonical.match?.type ?? "alias"}`,
        matchedAlias: canonical.match?.matchedAlias ?? null,
      });
    }

    for (const p of osmPlaces) {
      const label = p.shortName || p.name;
      if (!seen.has(label)) {
        seen.add(label);
        suggestions.push(label);
        places.push({
          name: label,
          fullName: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          source: p.source,
        });
      }
    }

    for (const name of [...stops, ...pois]) {
      if (!seen.has(name)) {
        seen.add(name);
        suggestions.push(name);
      }
      if (suggestions.length >= 20) break;
    }

    return {
      suggestions: suggestions.slice(0, 20),
      places: places.slice(0, 12),
      country: "ET",
      mapProvider: "openstreetmap",
    };
  }
}
