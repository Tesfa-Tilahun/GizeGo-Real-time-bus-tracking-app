export class UpdateBusAssignmentUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute(routeId, busId, assignment) {
    await this.routeRepository.updateBusAssignment(routeId, busId, assignment);
  }
}
