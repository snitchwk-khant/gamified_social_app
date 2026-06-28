import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function setToken(token) {
  window.localStorage.setItem("gamify_token", token);
}

function getToken() {
  return window.localStorage.getItem("gamify_token");
}

function logout() {
  window.localStorage.removeItem("gamify_token");
}

async function login(credentials) {
  const response = await axios.post(`${API_BASE}/auth/login`, credentials, {
    headers: { "Content-Type": "application/json" },
  });

  const { token, user } = response.data;
  setToken(token);
  return user;
}

async function fetchProfile(token) {
  try {
    const response = await axios.get(`${API_BASE}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data.user;
  } catch {
    logout();
    return null;
  }
}

export default {
  setToken,
  getToken,
  login,
  logout,
  fetchProfile,
};
