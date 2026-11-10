import { AppError } from "../shared/errors/AppError.js";
import { normalizeEmail, normalizePhone } from "../shared/utils/identity.js";

export class LoginUserUseCase {
  constructor(userRepository, passwordHasher, tokenService) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
  }

  async execute(input) {
    const identifier = input.identifier.trim();
    const user = identifier.includes("@")
      ? await this.userRepository.findByEmail(normalizeEmail(identifier) ?? "")
      : await this.userRepository.findByPhone(normalizePhone(identifier) ?? "");

    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = this.tokenService.sign({ sub: user.id, role: user.role });

    return { user, token };
  }
}
