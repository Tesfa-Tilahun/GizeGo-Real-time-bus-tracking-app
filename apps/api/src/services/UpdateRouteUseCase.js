export class UpdateRouteUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute(routeId, patch) {
    return this.routeRepository.update(routeId, patch);
  }
}
