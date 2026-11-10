import { randomUUID } from "node:crypto";

export class CreateRouteUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute(input) {
    const id =
      input.id ??
      (input.code ? `route-${String(input.code).toLowerCase()}` : randomUUID());
    return this.routeRepository.create({
      id,
      code: input.code,
      name: input.name,
      polyline: input.polyline,
      distanceMeters: input.distanceMeters,
      durationMinutes: input.durationMinutes,
      price: input.price,
      stops: input.stops,
    });
  }
}
