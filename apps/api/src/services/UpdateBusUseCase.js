import { AppError } from "../shared/errors/AppError.js";

export class UpdateBusUseCase {
  constructor(busRepository, operatorRepository = null) {
    this.busRepository = busRepository;
    this.operatorRepository = operatorRepository;
  }

  async execute(busId, patch) {
    if (patch.operator !== undefined) {
      const existing = await this.busRepository.findById(busId);
      if (!existing) {
        throw new AppError("Bus not found", 404);
      }
      const nextOperator = patch.operator;
      if (nextOperator && this.operatorRepository) {
        const exists = await this.operatorRepository.exists(nextOperator);
        if (!exists) {
          throw new AppError("Operator not found", 400);
        }
      }
    }

    const updated = await this.busRepository.update(busId, patch);
    if (!updated) {
      throw new AppError("Bus not found", 404);
    }
    return updated;
  }
}
