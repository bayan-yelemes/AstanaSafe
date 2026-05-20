import { reportError } from "./logger";

const USER_STORAGE_KEYS = ["astanasafe_user", "user", "auth_user"];

export function normalizeStoredUser(user) {
  if (!user) return null;

  const role = ["driver", "dispatcher", "admin"].includes(user.role)
    ? user.role
    : "driver";

  return {
    ...user,
    role,
  };
}

export function getStoredUser() {
  for (const key of USER_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      return normalizeStoredUser(JSON.parse(raw));
    } catch (error) {
      reportError("Failed to parse stored user:", error);
    }
  }

  return null;
}

export function persistCurrentUser(user) {
  localStorage.setItem("astanasafe_user", JSON.stringify(normalizeStoredUser(user)));
}

export function clearStoredUser() {
  USER_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem("token");
  localStorage.removeItem("access_token");
}

export function updateStoredUsers(currentUser, updates) {
  const rawUsers = localStorage.getItem("astanasafe_users");
  const users = rawUsers ? JSON.parse(rawUsers) : [];

  const updatedUsers = users.map((user) => {
    const sameUser =
      user.id === currentUser?.id ||
      user.email === currentUser?.email ||
      user.phone === currentUser?.phone;

    return sameUser ? { ...user, ...updates } : user;
  });

  localStorage.setItem("astanasafe_users", JSON.stringify(updatedUsers));
}
