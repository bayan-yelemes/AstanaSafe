import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  Settings,
  X,
  User,
  ShieldCheck,
  Upload,
  Download,
  Database,
  Lock,
  Mail,
  Phone,
} from "../../components/UI/icons";
import FilterField from "./FilterField";
import styles from "../../pages/Account.module.css";

export default function SettingsModal({
  open,
  onClose,
  currentUser,
  updateCurrentUser,
  saveCurrentUserProfile,
  changePassword,
  myReports,
  t,
}) {
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState("profile");

  const [name, setName] = useState(
    currentUser?.full_name || currentUser?.name || "",
  );
  const [contact, setContact] = useState(
    currentUser?.email || currentUser?.phone || "",
  );
  const [profileMessage, setProfileMessage] = useState("");
  const [profileOk, setProfileOk] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordOk, setPasswordOk] = useState(true);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setTab("profile");
      setName(currentUser?.full_name || currentUser?.name || "");
      setContact(currentUser?.email || currentUser?.phone || "");
      setProfileMessage("");
      setPasswordMessage("");
      setProfileOk(true);
      setPasswordOk(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open, currentUser]);

  if (!open) return null;

  const handleSaveProfile = async () => {
    if (!contact.trim()) {
      setProfileOk(false);
      setProfileMessage(t("account.contactRequired"));
      return;
    }

    const updates = {
      full_name: name.trim(),
      email: contact.includes("@") ? contact.trim() : "",
      phone: contact.includes("@") ? "" : contact.trim(),
    };

    const result = await saveCurrentUserProfile(updates);
    setProfileOk(result.ok);
    setProfileMessage(
      result.ok
        ? t("account.profileUpdated")
        : result.messageKey
          ? t(result.messageKey)
          : result.message || t("account.profileSaveError"),
    );
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      updateCurrentUser({ avatar: reader.result });
      setProfileMessage(t("account.photoUpdated"));
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async () => {
    const result = await changePassword({
      currentPassword,
      newPassword,
      confirmPassword: confirmNewPassword,
    });

    setPasswordOk(result.ok);
    setPasswordMessage(
      result.ok
        ? t("account.passwordUpdated")
        : result.messageKey
          ? t(result.messageKey)
          : result.message || t("account.passwordChangeError"),
    );

    if (result.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    }
  };

  const handleExportMarkers = () => {
    const blob = new Blob([JSON.stringify(myReports, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-markers.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLocalCache = () => {
    localStorage.removeItem("astanasafe-store");
    localStorage.removeItem("astanasafe_user");
    localStorage.removeItem("user");
    localStorage.removeItem("auth_user");
    window.location.reload();
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(t("account.deleteAccountConfirm"));
    if (!confirmed) return;

    localStorage.removeItem("astanasafe-store");
    localStorage.removeItem("astanasafe_user");
    localStorage.removeItem("user");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    window.location.href = "/";
  };

  return createPortal(
    <div
      className={["modal-backdrop", styles.accountStyle3]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={["motion-modal", styles.accountStyle4]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.accountStyle5}>
          <div className={styles.accountStyle6}>
            <div className={styles.accountStyle7}>
              <div className={styles.accountStyle8}>
                <Settings size={16} color="#fff" />
              </div>
              {t("account.settings")}
            </div>

            <button
              type="button"
              onClick={onClose}
              className={styles.accountStyle9}
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.accountStyle10}>
            <button
              type="button"
              onClick={() => setTab("profile")}
              style={sideTabStyle(tab === "profile")}
            >
              <User size={16} />
              {t("account.profile")}
            </button>

            <button
              type="button"
              onClick={() => setTab("privacy")}
              style={sideTabStyle(tab === "privacy")}
            >
              <ShieldCheck size={16} />
              {t("account.privacyData")}
            </button>
          </div>

          <div className={styles.accountStyle11}>ASTANASAFE V2.4.0</div>
        </div>

        <div className={styles.accountStyle12}>
          <div className={styles.accountStyle13}>
            <div className={styles.accountStyle14}>
              {tab === "profile"
                ? t("account.userProfile")
                : t("account.privacyAccountData")}
            </div>

            <button
              type="button"
              onClick={onClose}
              className={styles.accountStyle15}
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.accountStyle16}>
            {tab === "profile" ? (
              <>
                <div className={styles.accountStyle17}>
                  <div className={styles.accountStyle18}>
                    <img
                      src={
                        currentUser?.avatar ||
                        "https://placehold.co/84x84/e5e7eb/64748b?text=User"
                      }
                      alt="Profile"
                      className={styles.accountStyle19}
                    />

                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className={styles.accountStyle20}
                    >
                      <Upload size={14} />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className={styles.accountStyle21}
                    />
                  </div>

                  <div>
                    <div className={styles.fieldLabel}>
                      {t("account.displayName")}
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("account.enterName")}
                      className={styles.settingsInputStyle}
                    />
                  </div>
                </div>

                <div className={styles.accountStyle22}>
                  <div className={styles.fieldLabel}>
                    {contact.includes("@") ? (
                      <span className={styles.accountStyle23}>
                        <Mail size={14} />
                        {t("account.emailAddress")}
                      </span>
                    ) : (
                      <span className={styles.accountStyle24}>
                        <Phone size={14} />
                        {t("account.contactInfo")}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={t("account.emailOrPhone")}
                    className={styles.settingsInputStyle}
                  />

                  <div className={styles.accountStyle25}>
                    {t("account.updateContact")}
                  </div>
                </div>

                <div className={styles.accountStyle26}>
                  <div className={styles.accountStyle27}>
                    {t("account.changePassword")}
                  </div>

                  <div className={styles.accountStyle28}>
                    <div>
                      <div className={styles.fieldLabel}>
                        <span className={styles.accountStyle29}>
                          <Lock size={14} />
                          {t("account.currentPassword")}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={t("account.enterCurrentPassword")}
                        className={styles.settingsInputStyle}
                      />
                    </div>

                    <div>
                      <div className={styles.fieldLabel}>
                        {t("account.newPassword")}
                      </div>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t("account.enterNewPassword")}
                        className={styles.settingsInputStyle}
                      />
                    </div>

                    <div>
                      <div className={styles.fieldLabel}>
                        {t("account.confirmNewPassword")}
                      </div>
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder={t("account.confirmNewPasswordPlaceholder")}
                        className={styles.settingsInputStyle}
                      />
                    </div>
                  </div>
                </div>

                {(profileMessage || passwordMessage) && (
                  <div className={styles.accountStyle30}>
                    {profileMessage ? (
                      <div
                        className={styles.accountStyle31}
                        data-tone={profileOk ? "success" : "danger"}
                      >
                        {profileMessage}
                      </div>
                    ) : null}

                    {passwordMessage ? (
                      <div
                        style={{
                          background: passwordOk ? "#ecfdf5" : "#fef2f2",
                          color: passwordOk ? "#059669" : "#dc2626",
                          border: `1px solid ${
                            passwordOk ? "#d1fae5" : "#fecaca"
                          }`,

                          borderRadius: "14px",
                          padding: "12px 14px",
                          fontWeight: 700,
                          fontSize: "13px",
                        }}
                      >
                        {passwordMessage}
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.accountStyle32}>
                  <div className={styles.accountStyle33}>
                    <div className={styles.accountStyle34}>✓</div>
                    <div>
                      <div className={styles.accountStyle35}>
                        {t("account.anonymousReporting")}
                      </div>
                      <div className={styles.accountStyle36}>
                        {t("account.anonymousReportingDescription")}
                      </div>
                    </div>
                  </div>

                  <div className={styles.accountStyle37}>
                    <div className={styles.accountStyle38} />
                  </div>
                </div>

                <div className={styles.accountStyle39}>
                  {t("account.dataManagement")}
                </div>

                <div className={styles.accountStyle40}>
                  {t("account.dataManagementDescription")}
                </div>

                <div className={styles.accountStyle41}>
                  <button
                    type="button"
                    onClick={handleExportMarkers}
                    className={styles.dataBtnStyle}
                  >
                    <Download size={14} />
                    {t("account.exportMarkers")}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearLocalCache}
                    className={styles.dataBtnStyle}
                  >
                    <Database size={14} />
                    {t("account.clearLocalCache")}
                  </button>
                </div>

                <div className={styles.accountStyle42}>
                  <div className={styles.accountStyle43}>
                    {t("account.dangerZone")}
                  </div>

                  <div className={styles.accountStyle44}>
                    {t("account.deleteAccountDescription")}
                  </div>

                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className={styles.accountStyle45}
                  >
                    {t("account.deleteAccountPermanently")}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className={styles.accountStyle46}>
            {tab === "profile" ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className={styles.modalPrimaryBtn}
                >
                  {t("account.saveProfile")}
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  className={styles.modalPrimaryBtn}
                >
                  {t("account.changePassword")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className={styles.modalPrimaryBtn}
              >
                {t("common.close")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const sideTabStyle = (active) => ({
  border: active ? "1px solid var(--primary-border)" : "1px solid transparent",
  background: active ? "var(--surface)" : "transparent",
  color: active ? "var(--primary)" : "var(--text-muted)",
  height: "44px",
  borderRadius: "14px",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "0 14px",
  boxShadow: active ? "0 4px 12px rgba(15,23,42,0.05)" : "none",
});
