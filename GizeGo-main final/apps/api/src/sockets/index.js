import { Server } from "socket.io";
import { BusTrackingSimulator } from "../services/BusTrackingSimulator.js";
import { notificationEmitter } from "../services/NotificationEmitter.js";
import { trafficSimulation } from "../services/TrafficSimulationService.js";
import { pool } from "../config/database.js";

/**
 * @param {import("http").Server} httpServer
 */
export function attachSocketIo(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const simulator = new BusTrackingSimulator(pool, io);
  simulator.start();

  io.on("connection", (socket) => {
    socket.emit("tracking:ready", {
      message: "GizeGo live bus simulation connected",
      simulation: true,
    });

    socket.on("subscribe-route", (payload) => {
      const routeId = payload?.routeId;
      if (!routeId || typeof routeId !== "string") return;
      socket.join(`route:${routeId}`);
      const fresh = Boolean(payload?.fresh);
      if (fresh || socket.data?.routeWatch?.routeId !== routeId) {
        notificationEmitter.onRouteSubscribe(socket, routeId, {
          etaMinutes: Number.isFinite(Number(payload?.etaMinutes))
            ? Number(payload.etaMinutes)
            : null,
          stopName: payload?.stopName ?? null,
          busName: payload?.busName ?? null,
        });
      }
      socket.emit("tracking:subscribed", { routeId });
      if (simulator) {
        const buses = simulator.getBusesForRoute(routeId);
        socket.emit("bus:locations", {
          routeId,
          buses,
          traffic: trafficSimulation.get(routeId) ?? null,
          simulation: true,
        });
      }
    });

    socket.on("update-route-watch", (payload) => {
      const routeId = payload?.routeId;
      if (!routeId || typeof routeId !== "string") return;
      notificationEmitter.updateRouteWatch(socket, routeId, {
        etaMinutes: Number.isFinite(Number(payload?.etaMinutes))
          ? Number(payload.etaMinutes)
          : null,
        stopName: payload?.stopName ?? null,
        busName: payload?.busName ?? null,
      });
    });

    socket.on("unsubscribe-route", ({ routeId }) => {
      if (!routeId || typeof routeId !== "string") return;
      socket.leave(`route:${routeId}`);
      if (socket.data?.routeWatch?.routeId === routeId) {
        notificationEmitter.clearRouteWatch(socket);
      }
    });

    /** Real-time passenger GPS in Ethiopia (shared with map clients). */
    socket.on("passenger:location", (payload) => {
      const lat = Number(payload?.latitude);
      const lng = Number(payload?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const update = {
        socketId: socket.id,
        latitude: lat,
        longitude: lng,
        accuracy: payload?.accuracy ?? null,
        heading: payload?.heading ?? null,
        speed: payload?.speed ?? null,
        updatedAt: new Date().toISOString(),
        country: "ET",
      };
      socket.data.lastLocation = update;
      socket.broadcast.emit("passenger:location", update);
      if (simulator) {
        const nearby = simulator.findNearby(lat, lng, 8000);
        socket.emit("nearby:buses", { buses: nearby, userLocation: { latitude: lat, longitude: lng } });
      }
    });

    socket.on("disconnect", () => {
      notificationEmitter.clearRouteWatch(socket);
    });
  });

  return { io, simulator };
}
