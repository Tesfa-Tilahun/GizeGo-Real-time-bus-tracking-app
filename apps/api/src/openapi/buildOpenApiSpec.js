import { env } from "../config/env.js";

export function buildOpenApiSpec() {
  const bearer = {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "GizeGo API",
      version: "1.0.0",
      description:
        "GizeGo API: health, auth, routes, buses, and map/search. **Try it out** in Swagger uses the same host you opened in the browser (no need to match `PUBLIC_BASE_URL`).",
    },
    servers: [{ url: env.publicBaseUrl }],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Routes" },
      { name: "Buses" },
    ],
    paths: {
      "/api/v1/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            "200": { description: "OK" },
          },
        },
      },
      "/api/v1/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "password"],
                  properties: {
                    name: { type: "string", minLength: 2, maxLength: 120 },
                    email: { type: "string", format: "email" },
                    phone: { type: "string", minLength: 7, maxLength: 30 },
                    password: { type: "string", minLength: 6 },
                    role: {
                      type: "string",
                      enum: ["passenger", "driver", "ticket_vendor"],
                      description: "Defaults to passenger. Admin cannot self-register.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "422": { description: "Validation error" },
            "409": { description: "Email or phone already registered" },
          },
        },
      },
      "/api/v1/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["identifier", "password"],
                  properties: {
                    identifier: {
                      type: "string",
                      description: "Email or phone",
                    },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "OK — returns JWT" },
            "401": { description: "Invalid credentials" },
          },
        },
      },
      "/api/v1/auth/forgot-password": {
        post: {
          tags: ["Auth"],
          summary: "Forgot password — email reset code",
          description:
            "If the account exists, a one-time token is created and **sent by email** when **SMTP** is configured " +
            "(`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`). " +
            "Without SMTP, in **development** only the server may log the token. " +
            "Set **PASSWORD_RESET_RETURN_TOKEN=true** to also return `devResetToken` in JSON (testing only — never in production).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: {
                    email: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      devResetToken: {
                        type: "string",
                        description: "Only when PASSWORD_RESET_RETURN_TOKEN=true",
                      },
                      devHint: { type: "string" },
                    },
                  },
                },
              },
            },
            "422": { description: "Validation error" },
          },
        },
      },
      "/api/v1/auth/reset-password": {
        post: {
          tags: ["Auth"],
          summary: "Reset password with one-time token",
          description:
            "Use the plain token from the API dev log or from `devResetToken` when testing. " +
            "Then sign in with **Login** using email/phone + new password.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token", "password"],
                  properties: {
                    token: { type: "string", minLength: 16, description: "One-time reset code" },
                    password: { type: "string", minLength: 6 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Password updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { message: { type: "string" } },
                  },
                },
              },
            },
            "400": { description: "Invalid or expired token" },
            "422": { description: "Validation error" },
          },
        },
      },
      "/api/v1/auth/google": {
        post: {
          tags: ["Auth"],
          summary: "Google sign-in / sign-up (ID token)",
          description:
            "Send a Google **ID token** (`id_token`) from your client OAuth flow. " +
            "Creates or links a passenger account and returns the same JWT shape as **Login**. " +
            "Server must have **GOOGLE_OAUTH_CLIENT_IDS** set to the OAuth client ID(s) that issued the token (comma-separated).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["idToken"],
                  properties: {
                    idToken: {
                      type: "string",
                      minLength: 20,
                      description: "Google OIDC ID token (JWT string)",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OK — JWT + user (same as login)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      token: { type: "string" },
                      user: { $ref: "#/components/schemas/PublicUser" },
                    },
                  },
                },
              },
            },
            "401": { description: "Invalid or unverifiable ID token" },
            "409": { description: "Email linked to another Google account" },
            "422": { description: "Validation error" },
            "503": { description: "Google not configured (GOOGLE_OAUTH_CLIENT_IDS empty)" },
          },
        },
      },
      "/api/v1/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout (revoke current JWT)",
          security: [{ bearerAuth: [] }],
          responses: {
            "204": { description: "Token revoked" },
            "401": { description: "Missing or invalid token" },
          },
        },
      },
      "/api/v1/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Current user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "OK" },
            "401": { description: "Unauthorized" },
          },
        },
        patch: {
          tags: ["Auth"],
          summary: "Update profile",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", nullable: true, format: "email" },
                    phone: { type: "string", nullable: true },
                    password: { type: "string", minLength: 6 },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
            "401": { description: "Unauthorized" },
            "409": { description: "Email or phone conflict" },
          },
        },
      },
      "/api/v1/auth/admin-only": {
        get: {
          tags: ["Auth"],
          summary: "Role check — admin only",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "OK" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/auth/driver-area": {
        get: {
          tags: ["Auth"],
          summary: "Role check — driver or admin",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "OK" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/auth/ticket-vendor-area": {
        get: {
          tags: ["Auth"],
          summary: "Role check — ticket_vendor or admin",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "OK" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/routes": {
        get: {
          tags: ["Routes"],
          summary: "List route summaries (public)",
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Routes"],
          summary: "Create route (admin)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateRouteBody" },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "422": { description: "Validation" },
          },
        },
      },
      "/api/v1/routes/{routeId}": {
        get: {
          tags: ["Routes"],
          summary: "Route detail, stops, and assigned buses (public)",
          parameters: [
            { name: "routeId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
        },
        patch: {
          tags: ["Routes"],
          summary: "Update route (admin)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "routeId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateRouteBody" },
              },
            },
          },
          responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
        },
        delete: {
          tags: ["Routes"],
          summary: "Delete route (admin)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "routeId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "204": { description: "Deleted" }, "404": { description: "Not found" } },
        },
      },
      "/api/v1/routes/{routeId}/buses": {
        get: {
          tags: ["Routes"],
          summary: "Buses assigned to a route (public)",
          parameters: [
            { name: "routeId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["buses"],
                    properties: {
                      buses: {
                        type: "array",
                        items: { $ref: "#/components/schemas/RouteBus" },
                      },
                    },
                  },
                },
              },
            },
            "404": { description: "Route not found" },
          },
        },
        post: {
          tags: ["Routes"],
          summary: "Assign or create a bus on a route (admin)",
          description:
            "Provide **exactly one** of `busId` (existing bus) or `newBusName` (creates a bus then assigns). " +
            "Both stops must exist on this route and must be different. Times are 24-hour **HH:mm** (e.g. `06:30`).",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "routeId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AssignBusToRouteBody" },
                examples: {
                  newBus: {
                    summary: "Create bus and assign",
                    value: {
                      newBusName: "Line 12-A",
                      departureStopId: "stop-uuid-1",
                      arrivalStopId: "stop-uuid-2",
                      departureTime: "06:30",
                      arrivalTime: "08:15",
                    },
                  },
                  existing: {
                    summary: "Assign existing bus",
                    value: {
                      busId: "bus-uuid",
                      departureStopId: "stop-uuid-1",
                      arrivalStopId: "stop-uuid-2",
                      departureTime: "06:30",
                      arrivalTime: "08:15",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "204": { description: "Assigned" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Route or bus not found" },
            "409": { description: "Bus already assigned to this route" },
            "422": { description: "Validation (stops, times, or busId/newBusName rules)" },
          },
        },
      },
      "/api/v1/routes/{routeId}/buses/{busId}": {
        patch: {
          tags: ["Routes"],
          summary: "Update bus schedule on a route (admin)",
          description:
            "Updates departure/arrival stops (must belong to this route and differ) and **HH:mm** times for this bus-route assignment.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "routeId", in: "path", required: true, schema: { type: "string" } },
            { name: "busId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateBusAssignmentBody" },
              },
            },
          },
          responses: {
            "204": { description: "Updated" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Route not found or bus not assigned to this route" },
            "422": { description: "Validation" },
          },
        },
        delete: {
          tags: ["Routes"],
          summary: "Unassign a bus from a route (admin)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "routeId", in: "path", required: true, schema: { type: "string" } },
            { name: "busId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "204": { description: "Removed" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/buses": {
        post: {
          tags: ["Buses"],
          summary: "Create a bus (admin)",
          description:
            "Creates a bus. You may **optionally attach a full schedule** in the same request: pass **routeId** plus departure/arrival stop ids (must exist on that route) and departure/arrival **HH:mm** times—same rules as **POST /routes/{routeId}/buses**.\n\n" +
            "**Either** send only `name`, **or** send `name` together with **all** of: `routeId`, `departureStopId`, `arrivalStopId`, `departureTime`, `arrivalTime`.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateBusBody" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created — response includes assigned route schedules when provided",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["bus"],
                    properties: { bus: { $ref: "#/components/schemas/BusDetail" } },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": {
              description: "Route not found — only when attaching schedule (rollback: bus row is deleted)",
            },
            "409": {
              description: "Bus already assigned to this route — only when attaching schedule (rollback)",
            },
            "422": {
              description: "Validation (partial schedule fields, invalid stops vs route, identical dep/arr stops, etc.)",
            },
          },
        },
        get: {
          tags: ["Buses"],
          summary: "List all buses (admin)",
          description: "Each item includes how many route assignments the bus has; use **GET /buses/{busId}** for full schedule per route.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      buses: {
                        type: "array",
                        items: { $ref: "#/components/schemas/BusListItem" },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/v1/buses/{busId}": {
        get: {
          tags: ["Buses"],
          summary: "Get bus by id with route schedules (admin)",
          description:
            "Returns the bus and every **route assignment** with departure/arrival stop ids and names and **HH:mm** times (from `bus_routes`).",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "busId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["bus"],
                    properties: { bus: { $ref: "#/components/schemas/BusDetail" } },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Bus not found" },
          },
        },
        patch: {
          tags: ["Buses"],
          summary: "Update bus entity (admin)",
          description:
            "Rename the bus. Per-route departure/arrival times and stops use **PATCH /routes/{routeId}/buses/{busId}**.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "busId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateBusEntityBody" },
              },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["bus"],
                    properties: { bus: { $ref: "#/components/schemas/BusListItem" } },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Bus not found" },
            "422": { description: "Validation error" },
          },
        },
        delete: {
          tags: ["Buses"],
          summary: "Delete bus (admin)",
          description:
            "Deletes the bus. Route rows in `bus_routes` are removed if the schema uses **ON DELETE CASCADE** from buses.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "busId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "204": { description: "Deleted" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Bus not found" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: bearer,
      },
      schemas: {
        PublicUser: {
          type: "object",
          description: "User fields returned from auth endpoints",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", nullable: true },
            phone: { type: "string", nullable: true },
            role: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        RoutePoint: {
          type: "object",
          required: ["name", "latitude", "longitude"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
          },
        },
        CreateRouteBody: {
          type: "object",
          required: ["name", "polyline", "price", "departure", "arrival"],
          properties: {
            name: { type: "string" },
            polyline: {
              type: "string",
              description: "Encoded polyline for the path through departure → waypoints → arrival",
            },
            distanceMeters: { type: "number", nullable: true },
            price: { type: "number", minimum: 0, description: "Fare (required)" },
            departure: { $ref: "#/components/schemas/RoutePoint" },
            arrival: { $ref: "#/components/schemas/RoutePoint" },
            waypoints: {
              type: "array",
              description: "Optional intermediate stops between departure and arrival",
              items: { $ref: "#/components/schemas/RoutePoint" },
            },
          },
        },
        UpdateRouteBody: {
          type: "object",
          description:
            "At least one field required. To change the path, send departure, arrival, and optionally waypoints together (or send legacy ordered stops with min 2 items).",
          properties: {
            name: { type: "string" },
            polyline: { type: "string" },
            distanceMeters: { type: "number", nullable: true },
            price: { type: "number", minimum: 0 },
            departure: { $ref: "#/components/schemas/RoutePoint" },
            arrival: { $ref: "#/components/schemas/RoutePoint" },
            waypoints: {
              type: "array",
              items: { $ref: "#/components/schemas/RoutePoint" },
            },
            stops: {
              type: "array",
              minItems: 2,
              items: {
                type: "object",
                required: ["name", "latitude", "longitude", "sequenceOrder"],
                properties: {
                  name: { type: "string" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  sequenceOrder: { type: "integer" },
                },
              },
            },
          },
        },
        BusSummary: {
          type: "object",
          description: "Minimal bus identifiers (historic); **POST /buses** returns **BusDetail** with schedules.",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        CreateBusBody: {
          type: "object",
          required: ["name"],
          description:
            "Send **name** only for a standalone bus.\n\n" +
            "To create and schedule in one step, send **routeId**, **departureStopId**, **arrivalStopId**, **departureTime**, and **arrivalTime** together (stops must belong to that route; **HH:mm** 24h).",
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 120,
              description: "Bus / line label shown to users.",
            },
            routeId: {
              type: "string",
              minLength: 1,
              description:
                "If you include schedule fields, route this bus belongs to (same semantics as POST /routes/{routeId}/buses).",
            },
            departureStopId: {
              type: "string",
              minLength: 1,
              description: "First stop leg for this bus on routeId (must be a stop on that route).",
            },
            arrivalStopId: {
              type: "string",
              minLength: 1,
              description: "Last stop leg on routeId (must differ from departure stop).",
            },
            departureTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              example: "06:30",
              description: "Start / departure clock time (**HH:mm**).",
            },
            arrivalTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              example: "08:15",
              description: "Arrival clock time (**HH:mm**).",
            },
          },
        },
        BusListItem: {
          type: "object",
          description: "Bus in list/update response; includes assignment count.",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            routeAssignmentsCount: { type: "integer", minimum: 0 },
          },
        },
        BusRouteAssignment: {
          type: "object",
          description: "One bus–route assignment with scheduled stops and times.",
          properties: {
            routeId: { type: "string" },
            routeName: { type: "string" },
            departureStopId: { type: "string" },
            arrivalStopId: { type: "string" },
            departureStopName: { type: "string", nullable: true },
            arrivalStopName: { type: "string", nullable: true },
            departureTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              description: "24h HH:mm when set",
            },
            arrivalTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              description: "24h HH:mm when set",
            },
            assignedAt: { type: "string", format: "date-time" },
          },
        },
        BusDetail: {
          type: "object",
          description: "Bus with full list of route assignments and schedules.",
          required: ["id", "name", "createdAt", "routeAssignments"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            routeAssignments: {
              type: "array",
              items: { $ref: "#/components/schemas/BusRouteAssignment" },
            },
          },
        },
        UpdateBusEntityBody: {
          type: "object",
          description: "At least one property required.",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
          },
          minProperties: 1,
        },
        RouteBus: {
          type: "object",
          description: "Bus assigned to a route with optional schedule fields.",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            departureStopId: { type: "string", nullable: true },
            arrivalStopId: { type: "string", nullable: true },
            departureStopName: { type: "string", nullable: true },
            arrivalStopName: { type: "string", nullable: true },
            departureTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              description: "24h HH:mm when set",
              nullable: true,
            },
            arrivalTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              description: "24h HH:mm when set",
              nullable: true,
            },
          },
        },
        AssignBusToRouteBody: {
          type: "object",
          required: ["departureStopId", "arrivalStopId", "departureTime", "arrivalTime"],
          description:
            "Exactly one of **busId** or **newBusName** must be sent. Stop ids must belong to `routeId`.",
          properties: {
            busId: {
              type: "string",
              minLength: 1,
              description: "Existing bus ID (exclusive with newBusName).",
            },
            newBusName: {
              type: "string",
              minLength: 1,
              maxLength: 120,
              description: "Creates a bus with this name and assigns it (exclusive with busId).",
            },
            departureStopId: { type: "string", minLength: 1 },
            arrivalStopId: { type: "string", minLength: 1 },
            departureTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              example: "06:30",
            },
            arrivalTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              example: "08:15",
            },
          },
        },
        UpdateBusAssignmentBody: {
          type: "object",
          required: ["departureStopId", "arrivalStopId", "departureTime", "arrivalTime"],
          description: "Four schedule fields required. Stops must belong to the route.",
          properties: {
            departureStopId: { type: "string", minLength: 1 },
            arrivalStopId: { type: "string", minLength: 1 },
            departureTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              example: "06:30",
            },
            arrivalTime: {
              type: "string",
              pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              example: "08:15",
            },
          },
        },
      },
    },
  };
}
