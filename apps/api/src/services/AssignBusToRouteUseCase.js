export class AssignBusToRouteUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute(routeId, busId, assignment) {
    await this.routeRepository.assignBusToRoute(routeId, busId, assignment);
  }
}
