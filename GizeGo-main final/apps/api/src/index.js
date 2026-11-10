import cors from "cors";
import express from "express";
import path from "node:path";
import { createServer } from "http";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { attachSocketIo } from "./sockets/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ensureSchema } from "./models/ensureSchema.js";
import { buildOpenApiSpec } from "./openapi/buildOpenApiSpec.js";
import { PostgresRouteRepository } from "./models/PostgresRouteRepository.js";
import { PostgresBusRepository } from "./models/PostgresBusRepository.js";
import { PostgresOperatorRepository } from "./models/PostgresOperatorRepository.js";
import { PostgresUserRepository } from "./models/PostgresUserRepository.js";
import { PostgresRevokedTokenRepository } from "./models/PostgresRevokedTokenRepository.js";
import { PostgresPasswordResetRepository } from "./models/PostgresPasswordResetRepository.js";
import { ListRouteSummariesUseCase } from "./services/ListRouteSummariesUseCase.js";
import { GetRouteByIdUseCase } from "./services/GetRouteByIdUseCase.js";
import { CreateRouteUseCase } from "./services/CreateRouteUseCase.js";
import { UpdateRouteUseCase } from "./services/UpdateRouteUseCase.js";
import { DeleteRouteUseCase } from "./services/DeleteRouteUseCase.js";
import { ListBusesOnRouteUseCase } from "./services/ListBusesOnRouteUseCase.js";
import { AssignBusToRouteUseCase } from "./services/AssignBusToRouteUseCase.js";
import { UpdateBusAssignmentUseCase } from "./services/UpdateBusAssignmentUseCase.js";
import { UnassignBusFromRouteUseCase } from "./services/UnassignBusFromRouteUseCase.js";
import { CreateBusUseCase } from "./services/CreateBusUseCase.js";
import { ListBusesUseCase } from "./services/ListBusesUseCase.js";
import { GetBusByIdUseCase } from "./services/GetBusByIdUseCase.js";
import { UpdateBusUseCase } from "./services/UpdateBusUseCase.js";
import { DeleteBusUseCase } from "./services/DeleteBusUseCase.js";
import { RouteManagementController } from "./controllers/RouteManagementController.js";
import {
  createRoutesManagementRouter,
  createBusesManagementRouter,
} from "./routes/routeManagementRoutes.js";
import { PostgresPoiRepository } from "./models/PostgresPoiRepository.js";
import { SearchRoutesUseCase } from "./services/SearchRoutesUseCase.js";
import { LocationAliasResolver } from "./services/LocationAliasResolver.js";
import { GetRecommendedRouteUseCase } from "./services/GetRecommendedRouteUseCase.js";
import { ListMapPoisUseCase } from "./services/ListMapPoisUseCase.js";
import { MapPlacesSearchUseCase } from "./services/MapPlacesSearchUseCase.js";
import { SearchController } from "./controllers/SearchController.js";
import { MapController } from "./controllers/MapController.js";
import { createSearchRouter } from "./routes/searchRoutes.js";
import { createMapRouter } from "./routes/mapRoutes.js";
import { TranslateController } from "./controllers/TranslateController.js";
import { createPublicRouter } from "./routes/publicRoutes.js";
import { pool } from "./config/database.js";
import { FleetBootstrapService } from "./services/FleetBootstrapService.js";
import { RouteOptimizationService } from "./services/RouteOptimizationService.js";
import { StopEtaService } from "./services/StopEtaService.js";
import { RoutePassengerInfoService } from "./services/RoutePassengerInfoService.js";
import { TrackingController } from "./controllers/TrackingController.js";
import { createTrackingRouter } from "./routes/trackingRoutes.js";
import { AuthController } from "./controllers/AuthController.js";
import { AdminController } from "./controllers/AdminController.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createAdminRouter } from "./routes/adminRoutes.js";
import { JwtTokenService } from "./services/JwtTokenService.js";
import { BcryptPasswordHasher } from "./services/BcryptPasswordHasher.js";
import { RegisterUserUseCase } from "./services/RegisterUserUseCase.js";
import { LoginUserUseCase } from "./services/LoginUserUseCase.js";
import { GetAuthenticatedUserUseCase } from "./services/GetAuthenticatedUserUseCase.js";
import { LogoutUserUseCase } from "./services/LogoutUserUseCase.js";
import { UpdateUserProfileUseCase } from "./services/UpdateUserProfileUseCase.js";
import { UploadUserAvatarUseCase } from "./services/UploadUserAvatarUseCase.js";
import { ForgotPasswordRequestUseCase } from "./services/ForgotPasswordRequestUseCase.js";
import { ResetPasswordUseCase } from "./services/ResetPasswordUseCase.js";
import { GoogleAuthUseCase } from "./services/GoogleAuthUseCase.js";
import { SmtpPasswordResetMailer } from "./services/SmtpPasswordResetMailer.js";
import {
  RouteCatalogSeedService,
  OperatorFleetSeedService,
} from "./services/RouteCatalogSeedService.js";
import {
  ListDriversUseCase,
  AssignDriverToBusUseCase,
  CreateDriverUseCase,
} from "./services/AdminFleetUseCases.js";
import { PostgresFeedbackRepository } from "./models/PostgresFeedbackRepository.js";
import { SubmitFeedbackUseCase, ListMyFeedbackUseCase, ListAdminFeedbackUseCase, ReviewFeedbackUseCase } from "./services/FeedbackUseCases.js";
import { FeedbackController } from "./controllers/FeedbackController.js";
import { createFeedbackRouter } from "./routes/feedbackRoutes.js";
import { AdminAnalyticsService } from "./services/AdminAnalyticsService.js";
import {
  ListOperatorsUseCase,
  CreateOperatorUseCase,
  UpdateOperatorUseCase,
  DeleteOperatorUseCase,
} from "./services/OperatorUseCases.js";
import { analyticsCollector } from "./services/AnalyticsCollector.js";

const routeRepository = new PostgresRouteRepository();
const busRepository = new PostgresBusRepository();
const operatorRepository = new PostgresOperatorRepository();
const userRepository = new PostgresUserRepository();
const feedbackRepository = new PostgresFeedbackRepository();
const revokedTokenRepository = new PostgresRevokedTokenRepository();
const passwordResetRepository = new PostgresPasswordResetRepository();
const poiRepository = new PostgresPoiRepository();

const passwordHasher = new BcryptPasswordHasher();
const tokenService = new JwtTokenService(revokedTokenRepository);
const passwordResetMailer = new SmtpPasswordResetMailer(env.smtp);

const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService);
const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);
const getAuthenticatedUserUseCase = new GetAuthenticatedUserUseCase(userRepository);
const logoutUserUseCase = new LogoutUserUseCase(tokenService);
const updateUserProfileUseCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);
const uploadUserAvatarUseCase = new UploadUserAvatarUseCase(userRepository);
const forgotPasswordRequestUseCase = new ForgotPasswordRequestUseCase(
  userRepository,
  passwordResetRepository,
  passwordResetMailer,
);
const resetPasswordUseCase = new ResetPasswordUseCase(
  userRepository,
  passwordHasher,
  passwordResetRepository,
);
const googleAuthUseCase = new GoogleAuthUseCase(userRepository, passwordHasher, tokenService);

const authController = new AuthController(
  registerUserUseCase,
  loginUserUseCase,
  getAuthenticatedUserUseCase,
  logoutUserUseCase,
  updateUserProfileUseCase,
  forgotPasswordRequestUseCase,
  resetPasswordUseCase,
  googleAuthUseCase,
  busRepository,
  uploadUserAvatarUseCase,
);

const listDriversUseCase = new ListDriversUseCase(userRepository);
const assignDriverToBusUseCase = new AssignDriverToBusUseCase(busRepository, userRepository);
const createDriverUseCase = new CreateDriverUseCase(registerUserUseCase);
const listBusesUseCase = new ListBusesUseCase(busRepository);
const updateBusUseCase = new UpdateBusUseCase(busRepository, operatorRepository);
const listOperatorsUseCase = new ListOperatorsUseCase(operatorRepository);
const createOperatorUseCase = new CreateOperatorUseCase(operatorRepository);
const updateOperatorUseCase = new UpdateOperatorUseCase(operatorRepository);
const deleteOperatorUseCase = new DeleteOperatorUseCase(operatorRepository);

let busSimulator = null;
const getAllLiveBuses = () => (busSimulator ? busSimulator.getAllPublicBuses() : []);

const adminAnalyticsService = new AdminAnalyticsService(
  pool,
  getAllLiveBuses,
  analyticsCollector,
  routeRepository,
  feedbackRepository,
);
const listAdminFeedbackUseCase = new ListAdminFeedbackUseCase(feedbackRepository);
const reviewFeedbackUseCase = new ReviewFeedbackUseCase(feedbackRepository);

const adminController = new AdminController(
  listDriversUseCase,
  assignDriverToBusUseCase,
  createDriverUseCase,
  listBusesUseCase,
  updateBusUseCase,
  adminAnalyticsService,
  listOperatorsUseCase,
  createOperatorUseCase,
  updateOperatorUseCase,
  deleteOperatorUseCase,
  listAdminFeedbackUseCase,
  reviewFeedbackUseCase,
);

const feedbackController = new FeedbackController(
  new SubmitFeedbackUseCase(feedbackRepository, routeRepository),
  new ListMyFeedbackUseCase(feedbackRepository),
);
const routeManagementController = new RouteManagementController(
  new ListRouteSummariesUseCase(routeRepository),
  new GetRouteByIdUseCase(routeRepository),
  new CreateRouteUseCase(routeRepository),
  new UpdateRouteUseCase(routeRepository),
  new DeleteRouteUseCase(routeRepository),
  new ListBusesOnRouteUseCase(routeRepository),
  new AssignBusToRouteUseCase(routeRepository),
  new UnassignBusFromRouteUseCase(routeRepository),
  new CreateBusUseCase(busRepository, operatorRepository),
  listBusesUseCase,
  new UpdateBusAssignmentUseCase(routeRepository),
  new GetBusByIdUseCase(busRepository),
  updateBusUseCase,
  new DeleteBusUseCase(busRepository),
);
const locationAliasResolver = new LocationAliasResolver(routeRepository);
const searchController = new SearchController(
  new SearchRoutesUseCase(routeRepository, locationAliasResolver),
  locationAliasResolver,
);
const getRouteByIdUseCase = new GetRouteByIdUseCase(routeRepository);
const mapController = new MapController(
  new ListMapPoisUseCase(poiRepository),
  new GetRecommendedRouteUseCase(routeRepository),
  new MapPlacesSearchUseCase(routeRepository, poiRepository, locationAliasResolver),
  getRouteByIdUseCase,
  locationAliasResolver,
);
const translateController = new TranslateController();

const routeOptimizationService = new RouteOptimizationService(routeRepository);

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/v1/health", healthRouter);

function swaggerUiWithDynamicServer() {
  const setupOptions = { customCss: ".swagger-ui .topbar { display: none }" };
  return (req, res, next) => {
    const spec = buildOpenApiSpec();
    const base = `${req.protocol}://${req.get("host")}`;
    spec.servers = [{ url: base, description: "This API (same host as Swagger UI)" }];
    swaggerUi.setup(spec, setupOptions)(req, res, next);
  };
}

app.use("/api-docs", swaggerUi.serve, swaggerUiWithDynamicServer());
app.use("/api/v1/auth", createAuthRouter({ authController, tokenService }));
app.use("/api/v1/feedback", createFeedbackRouter({ feedbackController, tokenService }));
app.use("/api/v1/admin", createAdminRouter({ adminController, tokenService }));
app.use(
  "/api/v1/routes",
  createRoutesManagementRouter({ routeManagementController, tokenService }),
);
app.use(
  "/api/v1/buses",
  createBusesManagementRouter({ routeManagementController, tokenService }),
);
app.use("/api/v1/search", createSearchRouter({ searchController }));
app.use("/api/v1/map", createMapRouter({ mapController }));
const getLiveBusesForRoute = (routeId) =>
  busSimulator ? busSimulator.getBusesForRoute(routeId) : [];

const stopEtaService = new StopEtaService(routeRepository, getLiveBusesForRoute);
const listBusesOnRouteUseCase = new ListBusesOnRouteUseCase(routeRepository);
const routePassengerInfoService = new RoutePassengerInfoService(
  routeRepository,
  listBusesOnRouteUseCase,
  getLiveBusesForRoute,
  stopEtaService,
);

app.use(
  "/api/v1/tracking",
  createTrackingRouter({
    trackingController: new TrackingController(
      routeOptimizationService,
      stopEtaService,
      (lat, lng, radius) => (busSimulator ? busSimulator.findNearby(lat, lng, radius) : []),
      routePassengerInfoService,
    ),
  }),
);
app.use("/api/v1/public", createPublicRouter({ translateController }));
app.use(errorHandler);

async function bootstrap() {
  try {
    await ensureSchema();

    if (pool) {
      if (env.adminBootstrap.email && env.adminBootstrap.password.length >= 6) {
        const hash = await passwordHasher.hash(env.adminBootstrap.password);
        await userRepository.bootstrapAdminUser({
          email: env.adminBootstrap.email,
          passwordHash: hash,
        });
      }

      await new RouteCatalogSeedService(pool).seed();
      await new OperatorFleetSeedService(pool).seed();
      await new FleetBootstrapService(pool).ensureFleet();
    }

    const httpServer = createServer(app);
    const { simulator } = attachSocketIo(httpServer);
    busSimulator = simulator;
    httpServer.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${env.port} is already in use. Close the other app (or old \`npm run dev\`) or set PORT in .env (e.g. PORT=3001).`,
        );
      } else {
        console.error(err);
      }
      process.exit(1);
    });

    httpServer.listen(env.port, () => {
      console.log(`API listening on http://localhost:${env.port}`);
      console.log(`OpenAPI UI: http://localhost:${env.port}/api-docs`);
      console.log(`WebSocket bus simulation: ws://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to bootstrap API", error);
    process.exit(1);
  }
}

void bootstrap();
