import { AppError } from "../shared/errors/AppError.js";

export class GetRouteByIdUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute(id) {
    const route = await this.routeRepository.findById(id);
    if (!route) {
      throw new AppError("Route not found", 404);
    }
    return route;
  }
}
