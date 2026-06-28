import jwt from "jsonwebtoken";
import config from "../config/index.js";
import User from "../models/user_model.js";
import { fail } from "../utils/response.js";

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return fail(res, 401, "AUTH_REQUIRED", "Authentication required");
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.id)
      .select("-passwordHash -refreshTokens")
      .lean({ virtuals: true });

    if (!user) {
      return fail(res, 401, "INVALID_TOKEN", "Invalid authentication token");
    }

    req.user = user;
    next();
  } catch (error) {
    return fail(res, 401, "INVALID_TOKEN", "Invalid authentication token");
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return fail(res, 403, "FORBIDDEN", "You do not have permission to access this resource.");
    }

    next();
  };
}
