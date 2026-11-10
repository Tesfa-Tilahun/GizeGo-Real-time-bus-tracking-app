import { AppError } from "../shared/errors/AppError.js";

export class GetBusByIdUseCase {
  constructor(busRepository) {
    this.busRepository = busRepository;
  }

  async execute(busId) {
    const detail = await this.busRepository.findWithAssignments(busId);
    if (!detail) {
      throw new AppError("Bus not found", 404);
    }
    return detail;
  }
}
