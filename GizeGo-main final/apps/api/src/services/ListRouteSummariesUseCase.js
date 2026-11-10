export class ListRouteSummariesUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute() {
    return this.routeRepository.listSummaries();
  }
}
