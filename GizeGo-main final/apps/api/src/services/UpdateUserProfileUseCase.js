import { AppError } from "../shared/errors/AppError.js";
import { normalizeEmail, normalizePhone } from "../shared/utils/identity.js";

export class UpdateUserProfileUseCase {
  constructor(userRepository, passwordHasher) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
  }

  async execute(input) {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const hasField =
      input.name !== undefined ||
      input.email !== undefined ||
      input.phone !== undefined ||
      input.password !== undefined ||
      input.avatarUrl !== undefined;

    if (!hasField) {
      throw new AppError("No profile fields to update", 422);
    }

    const nextName = input.name !== undefined ? input.name.trim() : user.name;
    const nextEmail =
      input.email !== undefined ? normalizeEmail(input.email ?? undefined) : user.email;
    const nextPhone =
      input.phone !== undefined ? normalizePhone(input.phone ?? undefined) : user.phone;

    if (!nextEmail && !nextPhone) {
      throw new AppError("Email or phone is required", 422);
    }

    if (input.name !== undefined && nextName.length < 2) {
      throw new AppError("Name must be at least 2 characters", 422);
    }

    if (nextEmail && nextEmail !== user.email) {
      const taken = await this.userRepository.findByEmail(nextEmail);
      if (taken && taken.id !== user.id) {
        throw new AppError("Email is already in use", 409);
      }
    }

    if (nextPhone && nextPhone !== user.phone) {
      const taken = await this.userRepository.findByPhone(nextPhone);
      if (taken && taken.id !== user.id) {
        throw new AppError("Phone is already in use", 409);
      }
    }

    let passwordHash;
    if (input.password !== undefined) {
      if (input.password.length < 6) {
        throw new AppError("Password must be at least 6 characters", 422);
      }
      passwordHash = await this.passwordHasher.hash(input.password);
    }

    return this.userRepository.updateProfile(user.id, {
      name: input.name !== undefined ? nextName : undefined,
      email: input.email !== undefined ? nextEmail : undefined,
      phone: input.phone !== undefined ? nextPhone : undefined,
      passwordHash,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : undefined,
    });
  }
}
