export class ListBusesUseCase {
  constructor(busRepository) {
    this.busRepository = busRepository;
  }

  async execute() {
    return this.busRepository.listAll();
  }
}
