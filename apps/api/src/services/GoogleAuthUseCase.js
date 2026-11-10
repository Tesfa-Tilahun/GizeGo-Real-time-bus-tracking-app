import { randomUUID } from "node:crypto";
import { AppError } from "../shared/errors/AppError.js";
import { verifyGoogleIdToken } from "./googleIdToken.js";

export class GoogleAuthUseCase {
  constructor(userRepository, passwordHasher, tokenService) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
  }

  async execute(idToken) {
    const g = await verifyGoogleIdToken(idToken);

    let user = await this.userRepository.findByGoogleSub(g.sub);
    if (user) {
      return {
        user,
        token: this.tokenService.sign({ sub: user.id, role: user.role }),
      };
    }

    const byEmail = await this.userRepository.findByEmail(g.email);
    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== g.sub) {
        throw new AppError("This email is linked to another Google account", 409);
      }
      user = await this.userRepository.updateGoogleSub(byEmail.id, g.sub);
      return {
        user,
        token: this.tokenService.sign({ sub: user.id, role: user.role }),
      };
    }

    const passwordHash = await this.passwordHasher.hash(randomUUID() + randomUUID());
    user = await this.userRepository.create({
      id: randomUUID(),
      name: g.name,
      email: g.email,
      phone: null,
      passwordHash,
      role: "passenger",
      googleSub: g.sub,
    });

    return {
      user,
      token: this.tokenService.sign({ sub: user.id, role: user.role }),
    };
  }
}
