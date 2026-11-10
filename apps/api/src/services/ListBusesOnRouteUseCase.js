import { AppError } from "../shared/errors/AppError.js";

export class ListBusesOnRouteUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute(routeId) {
    const route = await this.routeRepository.findById(routeId);
    if (!route) {
      throw new AppError("Route not found", 404);
    }
    return this.routeRepository.listBusesOnRoute(routeId);
  }
}
