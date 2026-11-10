import { randomUUID } from "node:crypto";
import { AppError } from "../shared/errors/AppError.js";

export class CreateBusUseCase {
  constructor(busRepository, operatorRepository = null) {
    this.busRepository = busRepository;
    this.operatorRepository = operatorRepository;
  }

  async execute({ name, operator, status }) {
    if (operator && this.operatorRepository) {
      const exists = await this.operatorRepository.exists(operator);
      if (!exists) {
        throw new AppError("Operator not found", 400);
      }
    }

    return this.busRepository.create({
      id: randomUUID(),
      name,
      operator: operator ?? null,
      status: status ?? "active",
    });
  }
}
