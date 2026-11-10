import { randomUUID } from "node:crypto";
import { AppError } from "../shared/errors/AppError.js";
import { normalizeEmail, normalizePhone } from "../shared/utils/identity.js";

export class RegisterUserUseCase {
  constructor(userRepository, passwordHasher, tokenService) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
  }

  async execute(input) {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    const role = input.role ?? "passenger";

    if (!email && !phone) {
      throw new AppError("Email or phone is required", 422);
    }

    if (input.password.length < 6) {
      throw new AppError("Password must be at least 6 characters", 422);
    }

    if (email) {
      const existingByEmail = await this.userRepository.findByEmail(email);
      if (existingByEmail) {
        throw new AppError("Email is already registered", 409);
      }
    }

    if (phone) {
      const existingByPhone = await this.userRepository.findByPhone(phone);
      if (existingByPhone) {
        throw new AppError("Phone is already registered", 409);
      }
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.userRepository.create({
      id: randomUUID(),
      name: input.name.trim(),
      email,
      phone,
      passwordHash,
      role,
    });

    const token = this.tokenService.sign({ sub: user.id, role: user.role });

    return { user, token };
  }
}
