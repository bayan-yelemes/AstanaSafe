import axios from "axios";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "/api"
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

function clearExpiredAuthState() {
  localStorage.removeItem("token");

  const storedState = localStorage.getItem("astanasafe-store");
  if (storedState) {
    try {
      const parsedState = JSON.parse(storedState);
      localStorage.setItem(
        "astanasafe-store",
        JSON.stringify({
          ...parsedState,
          state: {
            ...(parsedState.state || {}),
            currentUser: null,
          },
        }),
      );
    } catch {
      localStorage.removeItem("astanasafe-store");
    }
  }

  window.dispatchEvent(new Event("astanasafe-auth-expired"));
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || "");
    const isAuthAttempt = [
      "/auth/login",
      "/auth/register",
      "/auth/google",
      "/auth/forgot-password",
      "/auth/reset-password",
    ].some((path) => url.includes(path));

    if (status === 401 && !isAuthAttempt) {
      clearExpiredAuthState();
    }

    return Promise.reject(error);
  },
);

export default api;
