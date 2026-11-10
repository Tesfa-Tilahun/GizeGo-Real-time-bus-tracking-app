import { AppError } from "../shared/errors/AppError.js";

export class ListDriversUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute() {
    return this.userRepository.listByRole("driver");
  }
}

export class AssignDriverToBusUseCase {
  constructor(busRepository, userRepository) {
    this.busRepository = busRepository;
    this.userRepository = userRepository;
  }

  async execute(busId, driverId) {
    const bus = await this.busRepository.findById(busId);
    if (!bus) {
      throw new AppError("Bus not found", 404);
    }

    if (driverId === null) {
      return this.busRepository.update(busId, { driverId: null });
    }

    const driver = await this.userRepository.findById(driverId);
    if (!driver || driver.role !== "driver") {
      throw new AppError("Driver not found", 404);
    }

    return this.busRepository.update(busId, { driverId });
  }
}

export class CreateDriverUseCase {
  constructor(registerUserUseCase) {
    this.registerUserUseCase = registerUserUseCase;
  }

  async execute(input) {
    return this.registerUserUseCase.execute({
      ...input,
      role: "driver",
    });
  }
}
