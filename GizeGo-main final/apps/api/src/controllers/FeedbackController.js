import { z } from "zod";

const submitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: z.enum(["service", "delay", "safety", "driver", "other", "general"]).optional(),
  comment: z.string().trim().min(3).max(2000),
  routeId: z.string().trim().min(1).max(64).optional(),
});

export class FeedbackController {
  constructor(submitFeedbackUseCase, listMyFeedbackUseCase) {
    this.submitFeedbackUseCase = submitFeedbackUseCase;
    this.listMyFeedbackUseCase = listMyFeedbackUseCase;
  }

  submit = async (req, res) => {
    const body = submitSchema.parse(req.body);
    const feedback = await this.submitFeedbackUseCase.execute({
      userId: req.authUser.userId,
      ...body,
    });
    res.status(201).json({
      message: "Thank you for your feedback",
      feedback: toPublicFeedback(feedback),
    });
  };

  listMine = async (req, res) => {
    const data = await this.listMyFeedbackUseCase.execute(req.authUser.userId);
    res.status(200).json({
      feedback: data.feedback.map(toPublicFeedback),
    });
  };
}

function toPublicFeedback(f) {
  return {
    id: f.id,
    routeId: f.routeId ?? null,
    routeName: f.routeName ?? null,
    rating: f.rating,
    category: f.category,
    comment: f.comment,
    status: f.status ?? "pending",
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
    reviewedAt:
      f.reviewedAt instanceof Date ? f.reviewedAt.toISOString() : f.reviewedAt ?? null,
  };
}
