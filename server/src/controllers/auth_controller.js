import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user_model.js";
import config from "../config/index.js";

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: "7d" });
  return res.json({ token, user: { name: user.name, email: user.email, bio: user.bio } });
}

export async function getProfile(req, res) {
  return res.json({ user: req.user });
}
