import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  Lock,
  RefreshCw,
  ShieldCheck,
  User,
} from "../components/UI/icons";
import SectionCard from "../components/UI/SectionCard";
import Topbar from "../components/UI/Topbar";
import { useI18n } from "../i18n";
import { getUsers, updateUser } from "../services/authService";
import { useAppStore } from "../store/useAppStore";
import { reportError } from "../utils/logger";
import styles from "./Admin.module.css";

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  role: "driver",
  password: "",
};

function getContact(user, t) {
  return user.email || user.phone || t("adminPage.noContact");
}

function Metric({ icon, label, value, color }) {
  return (
    <div className={styles.metric}>
      <div
        className={styles.metricIcon}
        style={{
          color,
          background: `${color}14`,
        }}
      >
        {icon({ size: 18 })}
      </div>
      <div>
        <div className={styles.metricLabel}>{label}</div>
        <div className={styles.metricValue}>{value}</div>
      </div>
    </div>
  );
}

function RoleBadge({ role, t }) {
  const color =
    role === "admin" ? "#7c3aed" : role === "dispatcher" ? "#2563eb" : "#16a34a";
  const roleLabels = {
    driver: t("sidebar.driverRole"),
    dispatcher: t("sidebar.dispatcherRole"),
    admin: t("sidebar.adminRole"),
  };

  return (
    <span
      className={styles.roleBadge}
      style={{
        color,
        background: `${color}14`,
      }}
    >
      {roleLabels[role] || roleLabels.driver}
    </span>
  );
}

export default function Admin() {
  const { t } = useI18n();
  const currentUser = useAppStore((state) => state.currentUser);
  const openAuthModal = useAppStore((state) => state.openAuthModal);
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasAdminAccess = currentUser?.role === "admin";

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [selectedUserId, users],
  );

  const metrics = useMemo(
    () => ({
      total: users.length,
      drivers: users.filter((user) => user.role === "driver").length,
      dispatchers: users.filter((user) => user.role === "dispatcher").length,
      admins: users.filter((user) => user.role === "admin").length,
    }),
    [users],
  );

  const loadUsers = useCallback(async () => {
    if (!hasAdminAccess) return;

    try {
      setLoading(true);
      setError("");
      const data = await getUsers();
      setUsers(data);

      setSelectedUserId((current) => current || data[0]?.id || null);
    } catch (error) {
      reportError("Failed to load users:", error);
      setError(error?.response?.data?.detail || t("adminPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [hasAdminAccess, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedUser) {
      setForm(emptyForm);
      return;
    }

    setForm({
      full_name: selectedUser.full_name || "",
      email: selectedUser.email || "",
      phone: selectedUser.phone || "",
      role: selectedUser.role || "driver",
      password: "",
    });
    setMessage("");
    setError("");
  }, [selectedUser]);

  const handleChange = (key, value) => {
    setForm((state) => ({
      ...state,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    const hasContact = form.email.trim() || form.phone.trim();
    if (!hasContact) {
      setError(t("adminPage.contactRequired"));
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const updated = await updateUser(selectedUser.id, {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        password: form.password.trim(),
      });

      setUsers((state) =>
        state.map((user) => (user.id === updated.id ? updated : user)),
      );

      if (currentUser?.id === updated.id) {
        updateCurrentUser(updated);
      }

      setForm((state) => ({ ...state, password: "" }));
      setMessage(t("adminPage.saveSuccess"));
    } catch (error) {
      reportError("Failed to update user:", error);
      setError(error?.response?.data?.detail || t("adminPage.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!hasAdminAccess) {
    return (
      <div>
        <Topbar
          titleKey="nav.admin"
          showTrafficAction={false}
          showEmergencyAction={false}
        />

        <SectionCard>
          <div className={styles.accessState}>
            <div className={styles.accessIcon}>
              <ShieldCheck size={34} />
            </div>
            <div>
              <h1>{t("adminPage.accessTitle")}</h1>
              <p>{t("adminPage.accessText")}</p>
              {!currentUser ? (
                <button type="button" onClick={openAuthModal}>
                  {t("adminPage.signInAction")}
                </button>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div>
      <Topbar
        titleKey="nav.admin"
        showTrafficAction={false}
        showEmergencyAction={false}
      />

      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>ADMIN CONSOLE</div>
          <h1>{t("adminPage.title")}</h1>
          <p>{t("adminPage.description")}</p>
        </div>

        <button type="button" onClick={loadUsers} className={styles.refresh}>
          <RefreshCw size={17} />
          {loading ? t("adminPage.updating") : t("adminPage.refresh")}
        </button>
      </div>

      <div className={styles.metrics}>
        <Metric icon={Database} label={t("adminPage.totalUsers")} value={metrics.total} color="#0f172a" />
        <Metric icon={User} label={t("adminPage.drivers")} value={metrics.drivers} color="#16a34a" />
        <Metric icon={ShieldCheck} label={t("adminPage.dispatchers")} value={metrics.dispatchers} color="#2563eb" />
        <Metric icon={Lock} label={t("adminPage.admins")} value={metrics.admins} color="#7c3aed" />
      </div>

      <div className={styles.contentGrid}>
        <SectionCard>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{t("adminPage.users")}</h2>
              <p>{t("adminPage.userCount", { count: users.length })}</p>
            </div>
          </div>

          <div className={styles.userList}>
            {users.length === 0 ? (
              <div className={styles.emptyState}>
                {loading ? t("adminPage.loadingUsers") : t("adminPage.usersNotFound")}
              </div>
            ) : (
              users.map((user) => {
                const selected = user.id === selectedUserId;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={[
                      styles.userRow,
                      selected ? styles.userRowActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className={styles.avatar}>
                      {(user.full_name || getContact(user, t)).slice(0, 1).toUpperCase()}
                    </span>
                    <span className={styles.userMeta}>
                      <strong>{user.full_name || t("adminPage.unnamed")}</strong>
                      <small>{getContact(user, t)}</small>
                    </span>
                    <RoleBadge role={user.role} t={t} />
                  </button>
                );
              })
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{t("adminPage.editData")}</h2>
              <p>
                {selectedUser
                  ? t("adminPage.selectedId", { id: selectedUser.id })
                  : t("adminPage.chooseUser")}
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label>
              <span>{t("adminPage.fullName")}</span>
              <input
                value={form.full_name}
                onChange={(event) => handleChange("full_name", event.target.value)}
                placeholder={t("adminPage.namePlaceholder")}
              />
            </label>

            <label>
              <span>Email</span>
              <input
                value={form.email}
                onChange={(event) => handleChange("email", event.target.value)}
                placeholder="user@example.com"
              />
            </label>

            <label>
              <span>{t("adminPage.phone")}</span>
              <input
                value={form.phone}
                onChange={(event) => handleChange("phone", event.target.value)}
                placeholder="+7 700 000 00 00"
              />
            </label>

            <label>
              <span>{t("adminPage.role")}</span>
              <select
                value={form.role}
                onChange={(event) => handleChange("role", event.target.value)}
              >
                <option value="driver">{t("sidebar.driverRole")}</option>
                <option value="dispatcher">{t("sidebar.dispatcherRole")}</option>
                <option value="admin">{t("sidebar.adminRole")}</option>
              </select>
            </label>

            <label className={styles.fullWidth}>
              <span>{t("adminPage.newPassword")}</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleChange("password", event.target.value)}
                placeholder={t("adminPage.passwordPlaceholder")}
              />
            </label>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
          {message ? <div className={styles.success}>{message}</div> : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedUser || saving}
            className={styles.saveButton}
          >
            <ShieldCheck size={17} />
            {saving ? t("adminPage.saving") : t("adminPage.saveChanges")}
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
