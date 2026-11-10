import { AppError } from "../shared/errors/AppError.js";

export class ListOperatorsUseCase {
  constructor(operatorRepository) {
    this.operatorRepository = operatorRepository;
  }

  async execute() {
    return this.operatorRepository.listWithBusCounts();
  }
}

export class CreateOperatorUseCase {
  constructor(operatorRepository) {
    this.operatorRepository = operatorRepository;
  }

  async execute({ name }) {
    return this.operatorRepository.create({ name });
  }
}

export class UpdateOperatorUseCase {
  constructor(operatorRepository) {
    this.operatorRepository = operatorRepository;
  }

  async execute(operatorId, { name }) {
    const updated = await this.operatorRepository.update(operatorId, { name });
    if (!updated) {
      throw new AppError("Operator not found", 404);
    }
    return updated;
  }
}

export class DeleteOperatorUseCase {
  constructor(operatorRepository) {
    this.operatorRepository = operatorRepository;
  }

  async execute(operatorId) {
    const deleted = await this.operatorRepository.deleteById(operatorId);
    if (!deleted) {
      throw new AppError("Operator not found", 404);
    }
  }
}
