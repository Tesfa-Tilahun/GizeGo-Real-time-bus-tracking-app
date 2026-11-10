import { z } from "zod";

const assignDriverSchema = z.object({
  driverId: z.string().uuid().nullable(),
});

const createDriverSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().email().optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    password: z.string().min(6),
  })
  .refine((v) => v.email || v.phone, {
    message: "Email or phone is required",
    path: ["email"],
  });

const assignBusOperatorSchema = z.object({
  operator: z.string().trim().min(1).max(32),
});

const createOperatorSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

const updateOperatorSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

const reviewFeedbackSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  reviewNote: z.string().trim().max(500).optional(),
});

export class AdminController {
  constructor(
    listDriversUseCase,
    assignDriverToBusUseCase,
    createDriverUseCase,
    listBusesUseCase,
    updateBusUseCase,
    adminAnalyticsService = null,
    listOperatorsUseCase = null,
    createOperatorUseCase = null,
    updateOperatorUseCase = null,
    deleteOperatorUseCase = null,
    listAdminFeedbackUseCase = null,
    reviewFeedbackUseCase = null,
  ) {
    this.listDriversUseCase = listDriversUseCase;
    this.assignDriverToBusUseCase = assignDriverToBusUseCase;
    this.createDriverUseCase = createDriverUseCase;
    this.listBusesUseCase = listBusesUseCase;
    this.updateBusUseCase = updateBusUseCase;
    this.adminAnalyticsService = adminAnalyticsService;
    this.listOperatorsUseCase = listOperatorsUseCase;
    this.createOperatorUseCase = createOperatorUseCase;
    this.updateOperatorUseCase = updateOperatorUseCase;
    this.deleteOperatorUseCase = deleteOperatorUseCase;
    this.listAdminFeedbackUseCase = listAdminFeedbackUseCase;
    this.reviewFeedbackUseCase = reviewFeedbackUseCase;
  }

  listDrivers = async (_req, res) => {
    const drivers = await this.listDriversUseCase.execute();
    res.status(200).json({ drivers });
  };

  createDriver = async (req, res) => {
    const body = createDriverSchema.parse(req.body);
    const result = await this.createDriverUseCase.execute(body);
    res.status(201).json({
      message: "Driver created",
      driver: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        role: result.user.role,
      },
    });
  };

  listFleet = async (_req, res) => {
    const buses = await this.listBusesUseCase.execute();
    res.status(200).json({ buses: buses.map(toPublicBus) });
  };

  assignDriver = async (req, res) => {
    const body = assignDriverSchema.parse(req.body);
    const bus = await this.assignDriverToBusUseCase.execute(
      String(req.params.busId),
      body.driverId,
    );
    res.status(200).json({ bus: toPublicBus(bus) });
  };

  assignOperator = async (req, res) => {
    const body = assignBusOperatorSchema.parse(req.body);
    const bus = await this.updateBusUseCase.execute(String(req.params.busId), {
      operator: body.operator,
    });
    res.status(200).json({ bus: toPublicBus(bus) });
  };

  listOperators = async (_req, res) => {
    const operators = await this.listOperatorsUseCase.execute();
    res.status(200).json({ operators: operators.map(toPublicOperator) });
  };

  createOperator = async (req, res) => {
    const body = createOperatorSchema.parse(req.body);
    const operator = await this.createOperatorUseCase.execute(body);
    res.status(201).json({ operator: toPublicOperator(operator) });
  };

  updateOperator = async (req, res) => {
    const body = updateOperatorSchema.parse(req.body);
    const operator = await this.updateOperatorUseCase.execute(String(req.params.operatorId), body);
    res.status(200).json({ operator: toPublicOperator(operator) });
  };

  deleteOperator = async (req, res) => {
    await this.deleteOperatorUseCase.execute(String(req.params.operatorId));
    res.status(204).send();
  };

  listFeedback = async (req, res) => {
    const data = await this.listAdminFeedbackUseCase.execute({
      status: req.query.status,
      routeId: req.query.routeId,
    });
    res.status(200).json({
      feedback: data.feedback.map(toPublicFeedback),
    });
  };

  reviewFeedback = async (req, res) => {
    const body = reviewFeedbackSchema.parse(req.body);
    const feedback = await this.reviewFeedbackUseCase.execute(String(req.params.feedbackId), body);
    res.status(200).json({ feedback: toPublicFeedback(feedback) });
  };

  dashboard = async (req, res) => {
    if (!this.adminAnalyticsService) {
      res.status(503).json({ message: "Analytics unavailable" });
      return;
    }
    const data = await this.adminAnalyticsService.getDashboard({
      period: req.query.period,
      routeId: req.query.routeId,
      busId: req.query.busId,
    });
    res.status(200).json(data);
  };

  analyticsReport = async (req, res) => {
    if (!this.adminAnalyticsService) {
      res.status(503).json({ message: "Analytics unavailable" });
      return;
    }
    const data = await this.adminAnalyticsService.getReport({
      period: req.query.period,
      routeId: req.query.routeId,
      busId: req.query.busId,
    });
    res.status(200).json(data);
  };
}

function toPublicFeedback(f) {
  return {
    id: f.id,
    userId: f.userId,
    userName: f.userName,
    userEmail: f.userEmail,
    routeId: f.routeId ?? null,
    routeName: f.routeName ?? null,
    rating: f.rating,
    category: f.category,
    comment: f.comment,
    status: f.status ?? "pending",
    reviewNote: f.reviewNote ?? null,
    createdAt: f.createdAt.toISOString(),
    reviewedAt: f.reviewedAt?.toISOString() ?? null,
  };
}

function toPublicOperator(o) {
  return {
    id: o.id,
    name: o.name,
    busCount: o.busCount ?? 0,
    createdAt: o.createdAt.toISOString(),
  };
}

function toPublicBus(b) {
  return {
    id: b.id,
    name: b.name,
    operator: b.operator,
    status: b.status ?? "active",
    driverId: b.driverId ?? null,
    driver: b.driver
      ? { id: b.driver.id, name: b.driver.name, email: b.driver.email, phone: b.driver.phone }
      : null,
    routeAssignmentsCount: b.routeAssignmentsCount ?? 0,
    createdAt: b.createdAt.toISOString(),
  };
}
