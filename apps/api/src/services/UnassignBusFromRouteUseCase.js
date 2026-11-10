export class UnassignBusFromRouteUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute(routeId, busId) {
    await this.routeRepository.unassignBusFromRoute(routeId, busId);
  }
}
