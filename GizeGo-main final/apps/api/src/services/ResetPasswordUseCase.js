import { AppError } from "../shared/errors/AppError.js";

export class ResetPasswordUseCase {
  constructor(userRepository, passwordHasher, passwordResetRepository) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.passwordResetRepository = passwordResetRepository;
  }

  async execute(plainToken, newPassword) {
    if (newPassword.length < 6) {
      throw new AppError("Password must be at least 6 characters", 422);
    }
    const userId = await this.passwordResetRepository.consume(plainToken);
    if (!userId) {
      throw new AppError("Invalid or expired reset code. Request a new link or code.", 400);
    }
    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.userRepository.updateProfile(userId, { passwordHash });
  }
}
