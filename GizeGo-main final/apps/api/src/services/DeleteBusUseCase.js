import { AppError } from "../shared/errors/AppError.js";

export class DeleteBusUseCase {
  constructor(busRepository) {
    this.busRepository = busRepository;
  }

  async execute(busId) {
    const deleted = await this.busRepository.deleteById(busId);
    if (!deleted) {
      throw new AppError("Bus not found", 404);
    }
  }
}
