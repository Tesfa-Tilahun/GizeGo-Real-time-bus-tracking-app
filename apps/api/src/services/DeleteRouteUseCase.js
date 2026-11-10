export class DeleteRouteUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute(routeId) {
    await this.routeRepository.delete(routeId);
  }
}
