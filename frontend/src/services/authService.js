import api from "../api/client";

export async function registerUser({ name, emailOrPhone, password }) {
  const contact = emailOrPhone.trim();
  const { data } = await api.post("/auth/register", {
    full_name: name.trim(),
    email: contact.includes("@") ? contact : null,
    phone: contact.includes("@") ? null : contact,
    password,
  });

  persistToken(data.access_token);
  return data.user;
}

export async function loginUser({ emailOrPhone, password }) {
  const contact = emailOrPhone.trim();
  const { data } = await api.post("/auth/login", {
    email: contact.includes("@") ? contact : null,
    phone: contact.includes("@") ? null : contact,
    password,
  });

  persistToken(data.access_token);
  return data.user;
}

export async function getCurrentUser() {
  const { data } = await api.get("/auth/me");

  return data;
}

export async function requestPasswordReset(email) {
  const { data } = await api.post("/auth/forgot-password", {
    email: email.trim(),
  });

  return data;
}

export async function resetPassword({ token, password }) {
  const { data } = await api.post("/auth/reset-password", {
    token,
    password,
  });

  return data;
}

export async function updateMyProfile(updates) {
  const { data } = await api.put("/auth/me", {
    full_name: updates.full_name || null,
    email: updates.email || null,
    phone: updates.phone || null,
  });

  return data;
}

export async function changeMyPassword({ currentPassword, newPassword }) {
  const { data } = await api.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });

  return data;
}

export async function getUsers() {
  const { data } = await api.get("/auth/users");

  return data || [];
}

export async function updateUser(userId, updates) {
  const { data } = await api.put(`/auth/users/${userId}`, {
    full_name: updates.full_name || null,
    email: updates.email || null,
    phone: updates.phone || null,
    role: updates.role || "driver",
    password: updates.password || null,
  });

  return data;
}

function persistToken(token) {
  if (token) {
    localStorage.setItem("token", token);
  }
}
