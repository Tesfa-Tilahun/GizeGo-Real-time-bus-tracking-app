import bcrypt from "bcryptjs";

export class BcryptPasswordHasher {
  async hash(value) {
    return bcrypt.hash(value, 10);
  }

  async compare(value, hashedValue) {
    return bcrypt.compare(value, hashedValue);
  }
}
