import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import http from "http";
import { connectDb, ensureDefaultUser } from "./config/db.js";
import config from "./config/index.js";
import registerCleanupTask from "./cron/cleanup_cron.js";
import { errorHandler, notFoundHandler } from "./middleware/error_middleware.js";
import adminRoutes from "./routes/admin_routes.js";
import announcementsRoutes from "./routes/announcements_routes.js";
import authRoutes from "./routes/auth_routes.js";
import commentsRoutes from "./routes/comments_routes.js";
import feedRoutes from "./routes/feed_routes.js";
import messagesRoutes from "./routes/messages_routes.js";
import notificationsRoutes from "./routes/notifications_routes.js";
import postsRoutes from "./routes/posts_routes.js";
import storiesRoutes from "./routes/stories_routes.js";
import usersRoutes from "./routes/users_routes.js";
import { authMiddleware } from "./middleware/auth_middleware.js";
import setupSocket from "./socket/socket_server.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = setupSocket(server, config.clientOrigin);
let databaseStatus = "disconnected";

app.set("io", io);
app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gamified-social-server",
    database: databaseStatus,
    timestamp: new Date().toISOString(),
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feed", authMiddleware, feedRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const port = config.port;

async function startServer() {
  try {
    await connectDb(config.mongoUri);
    databaseStatus = "connected";
    await ensureDefaultUser();
    registerCleanupTask("Asia/Yangon");
  } catch (error) {
    databaseStatus = "unavailable";
    console.warn("MongoDB is not connected yet. API health route will still run.", error.message);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
