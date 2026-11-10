export class ListMapPoisUseCase {
  constructor(poiRepository) {
    this.poiRepository = poiRepository;
  }

  execute(q) {
    return this.poiRepository.listPois(q);
  }
}
