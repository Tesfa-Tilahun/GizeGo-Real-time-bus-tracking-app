import { z } from "zod";
import { AppError } from "../shared/errors/AppError.js";

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().email().optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    password: z.string().min(6),
    role: z.enum(["passenger", "ticket_vendor"]).optional(),
  })
  .refine((value) => value.email || value.phone, {
    message: "Email or phone is required",
    path: ["email"],
  });

const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(6),
});

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.union([z.string().email(), z.null()]).optional(),
    phone: z.union([z.string().trim().min(7).max(30), z.null()]).optional(),
    password: z.string().min(6).optional(),
    avatarUrl: z.union([z.string().max(512), z.null()]).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.phone !== undefined ||
      value.password !== undefined ||
      value.avatarUrl !== undefined,
    { message: "At least one field is required", path: ["name"] },
  );

const uploadAvatarSchema = z.object({
  imageBase64: z.string().min(100).max(1_200_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(16),
  password: z.string().min(6),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(20),
});

export class AuthController {
  constructor(
    registerUserUseCase,
    loginUserUseCase,
    getAuthenticatedUserUseCase,
    logoutUserUseCase,
    updateUserProfileUseCase,
    forgotPasswordRequestUseCase,
    resetPasswordUseCase,
    googleAuthUseCase,
    busRepository = null,
    uploadUserAvatarUseCase = null,
  ) {
    this.registerUserUseCase = registerUserUseCase;
    this.loginUserUseCase = loginUserUseCase;
    this.getAuthenticatedUserUseCase = getAuthenticatedUserUseCase;
    this.logoutUserUseCase = logoutUserUseCase;
    this.updateUserProfileUseCase = updateUserProfileUseCase;
    this.forgotPasswordRequestUseCase = forgotPasswordRequestUseCase;
    this.resetPasswordUseCase = resetPasswordUseCase;
    this.googleAuthUseCase = googleAuthUseCase;
    this.busRepository = busRepository;
    this.uploadUserAvatarUseCase = uploadUserAvatarUseCase;
  }

  register = async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await this.registerUserUseCase.execute(input);

    res.status(201).json({
      message: "User registered successfully",
      token: result.token,
      user: toPublicUser(result.user),
    });
  };

  login = async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await this.loginUserUseCase.execute(input);

    res.status(200).json({
      message: "Login successful",
      token: result.token,
      user: toPublicUser(result.user),
    });
  };

  logout = async (req, res) => {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new AppError("Authorization token is required", 401);
    }
    const token = authorizationHeader.replace("Bearer ", "").trim();
    await this.logoutUserUseCase.execute(token);

    res.status(204).send();
  };

  me = async (req, res) => {
    const user = await this.getAuthenticatedUserUseCase.execute(req.authUser.userId);

    res.status(200).json({
      user: toPublicUser(user),
    });
  };

  updateProfile = async (req, res) => {
    const body = updateProfileSchema.parse(req.body);
    const user = await this.updateUserProfileUseCase.execute({
      userId: req.authUser.userId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password,
      avatarUrl: body.avatarUrl,
    });

    res.status(200).json({
      message: "Profile updated",
      user: toPublicUser(user),
    });
  };

  uploadAvatar = async (req, res) => {
    if (!this.uploadUserAvatarUseCase) {
      throw new AppError("Avatar upload is unavailable", 503);
    }
    const body = uploadAvatarSchema.parse(req.body);
    const user = await this.uploadUserAvatarUseCase.execute(req.authUser.userId, body);
    res.status(200).json({
      message: "Profile photo updated",
      user: toPublicUser(user),
    });
  };

  adminOnly = async (_req, res) => {
    res.status(200).json({
      message: "Admin access granted",
    });
  };

  driverOrAdmin = async (_req, res) => {
    res.status(200).json({
      message: "Driver or admin access granted",
    });
  };

  driverAssignment = async (req, res) => {
    if (!this.busRepository) {
      throw new AppError("Driver assignment is unavailable", 503);
    }
    const bus = await this.busRepository.findByDriverId(req.authUser.userId);
    if (!bus) {
      res.status(200).json({
        assigned: false,
        message: "No bus assigned yet. Contact your admin.",
      });
      return;
    }
    const detail = await this.busRepository.findWithAssignments(bus.id);
    res.status(200).json({
      assigned: true,
      bus: detail.bus,
      assignments: detail.assignments,
    });
  };

  ticketVendorOrAdmin = async (_req, res) => {
    res.status(200).json({
      message: "Ticket vendor or admin access granted",
    });
  };

  forgotPassword = async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const result = await this.forgotPasswordRequestUseCase.execute(body.email);
    res.status(200).json({
      message: result.message,
      ...(result.devResetToken
        ? { devResetToken: result.devResetToken, devHint: result.devHint }
        : {}),
    });
  };

  resetPassword = async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    await this.resetPasswordUseCase.execute(body.token, body.password);
    res.status(200).json({
      message: "Password updated. You can sign in with your new password.",
    });
  };

  googleAuth = async (req, res) => {
    const body = googleAuthSchema.parse(req.body);
    const result = await this.googleAuthUseCase.execute(body.idToken);
    res.status(200).json({
      message: "Login successful",
      token: result.token,
      user: toPublicUser(result.user),
    });
  };
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
