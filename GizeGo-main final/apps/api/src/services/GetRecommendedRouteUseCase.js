export class GetRecommendedRouteUseCase {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  async execute() {
    const list = await this.routeRepository.listSummaries();
    if (list.length === 0) {
      return {
        route: null,
        message: "Follow your recommended route here — add routes in the admin API when the database is ready.",
      };
    }
    const full = await this.routeRepository.findById(list[0].id);
    return {
      route: full,
      message: "Follow your recommended route here",
    };
  }
}
