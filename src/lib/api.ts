/**
 * Axios instance pre-configured for the Medihospes API.
 * Automatically attaches the JWT token from localStorage.
 */

import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

// Attach token on every request and ensure trailing slashes on paths
api.interceptors.request.use((config) => {
  // Ensure URL path ends with / or has query params to avoid 307 redirects
  if (config.url && !config.url.includes("?")) {
    if (!config.url.endsWith("/")) {
      config.url += "/";
    }
  } else if (config.url && config.url.includes("?")) {
    const [path, query] = config.url.split("?");
    if (!path.endsWith("/")) {
      config.url = path + "/?" + query;
    }
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
