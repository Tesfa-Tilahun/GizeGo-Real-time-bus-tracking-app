export class LogoutUserUseCase {
  constructor(tokenService) {
    this.tokenService = tokenService;
  }

  async execute(accessToken) {
    const payload = await this.tokenService.verify(accessToken);
    await this.tokenService.revokeToken(payload.jti, payload.expiresAt);
  }
}
