import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "../shared/errors/AppError.js";

const MAX_BYTES = 900_000;
const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class UploadUserAvatarUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
    this.uploadsDir = path.join(process.cwd(), "uploads", "avatars");
  }

  async execute(userId, { imageBase64, mimeType = "image/jpeg" }) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const ext = MIME_EXT[mimeType] ?? "jpg";
    let raw = String(imageBase64 ?? "").trim();
    const dataPrefix = raw.match(/^data:image\/[a-z+]+;base64,/i);
    if (dataPrefix) raw = raw.slice(dataPrefix[0].length);

    let buffer;
    try {
      buffer = Buffer.from(raw, "base64");
    } catch {
      throw new AppError("Invalid image data", 422);
    }

    if (!buffer.length || buffer.length > MAX_BYTES) {
      throw new AppError("Image must be under 900 KB", 422);
    }

    await fs.mkdir(this.uploadsDir, { recursive: true });
    const filename = `${userId}.${ext}`;
    await fs.writeFile(path.join(this.uploadsDir, filename), buffer);

    const avatarUrl = `/uploads/avatars/${filename}?v=${Date.now()}`;
    return this.userRepository.updateProfile(userId, { avatarUrl });
  }
}
