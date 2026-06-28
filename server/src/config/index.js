import dotenv from "dotenv";

dotenv.config();

export default {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/gamified_social_app",
  jwtSecret: process.env.JWT_SECRET || "replace_this_with_a_strong_secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "replace_this_with_a_different_strong_secret",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
};
