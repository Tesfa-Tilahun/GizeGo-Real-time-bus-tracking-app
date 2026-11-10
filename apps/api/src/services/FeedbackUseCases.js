import { randomUUID } from "node:crypto";
import { AppError } from "../shared/errors/AppError.js";

export class SubmitFeedbackUseCase {
  constructor(feedbackRepository, routeRepository) {
    this.feedbackRepository = feedbackRepository;
    this.routeRepository = routeRepository;
  }

  async execute({ userId, rating, category, comment, routeId }) {
    let resolvedRouteId = null;
    if (routeId) {
      const route = await this.routeRepository.findById(routeId);
      resolvedRouteId = route ? routeId : null;
    }

    const trimmed = comment?.trim();
    if (!trimmed || trimmed.length < 3) {
      throw new AppError("Comment must be at least 3 characters", 422);
    }

    return this.feedbackRepository.create({
      id: randomUUID(),
      userId,
      routeId: resolvedRouteId,
      rating,
      category: category ?? "general",
      comment: trimmed.slice(0, 2000),
    });
  }
}

export class ListMyFeedbackUseCase {
  constructor(feedbackRepository) {
    this.feedbackRepository = feedbackRepository;
  }

  async execute(userId) {
    const items = await this.feedbackRepository.listByUserId(userId);
    return { feedback: items };
  }
}

export class ListAdminFeedbackUseCase {
  constructor(feedbackRepository) {
    this.feedbackRepository = feedbackRepository;
  }

  async execute(filters = {}) {
    const feedback = await this.feedbackRepository.listForAdmin(filters);
    return { feedback };
  }
}

export class ReviewFeedbackUseCase {
  constructor(feedbackRepository) {
    this.feedbackRepository = feedbackRepository;
  }

  async execute(feedbackId, { status, reviewNote }) {
    const existing = await this.feedbackRepository.findById(feedbackId);
    if (!existing) {
      throw new AppError("Feedback not found", 404);
    }
    if (!["accepted", "rejected"].includes(status)) {
      throw new AppError("Status must be accepted or rejected", 400);
    }
    const updated = await this.feedbackRepository.updateReview(feedbackId, {
      status,
      reviewNote,
    });
    return updated;
  }
}
