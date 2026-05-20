import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/UI/Topbar";
import SectionCard from "../components/UI/SectionCard";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import styles from "./Settings.module.css";

export default function Settings() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const currentUser = useAppStore((state) => state.currentUser);
  const saveCurrentUserProfile = useAppStore(
    (state) => state.saveCurrentUserProfile,
  );
  const changePassword = useAppStore((state) => state.changePassword);

  const [name, setName] = useState(
    currentUser?.full_name || currentUser?.name || "",
  );
  const [contact, setContact] = useState(
    currentUser?.email || currentUser?.phone || "",
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileOk, setProfileOk] = useState(true);
  const [passwordOk, setPasswordOk] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate("/");
    }
  }, [currentUser, navigate]);

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

  return (
    <div>
      <Topbar title="Settings" />

      <div className={styles.settingsStyle1}>
        <SectionCard>
          <div className={styles.settingsStyle2}>{t("settings.myProfile")}</div>

          <div className={styles.settingsStyle3}>
            {t("settings.profileSubtitle")}
          </div>

          <div className={styles.settingsStyle4}>
            <div>
              <div className={styles.labelStyle}>
                {t("settings.editAccount")}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("settings.fullName")}
                className={styles.inputStyle}
              />
            </div>

            <div>
              <div className={styles.labelStyle}>
                {t("settings.contactInfo")}
              </div>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={t("settings.emailOrPhone")}
                className={styles.inputStyle}
              />
            </div>
          </div>

          <div className={styles.settingsStyle5}>
            <div className={styles.labelStyle}>
              {t("settings.notificationPreferences")}
            </div>
            <div className={styles.settingsStyle6}>
              {t("settings.notificationText")}
            </div>
          </div>

          <div className={styles.settingsStyle7}>
            <button
              type="button"
              onClick={() => navigate("/account")}
              className={styles.secondaryBtn}
            >
              {t("settings.backToAccount")}
            </button>

            <button
              type="button"
              onClick={handleSaveProfile}
              className={styles.primaryBtn}
            >
              {t("settings.saveChanges")}
            </button>
          </div>

          {profileMessage && (
            <div
              className={styles.settingsStyle8}
              data-tone={profileOk ? "success" : "danger"}
            >
              {profileMessage}
            </div>
          )}
        </SectionCard>

        <SectionCard>
          <div className={styles.settingsStyle9}>{t("settings.security")}</div>

          <div className={styles.settingsStyle10}>
            {t("settings.securitySubtitle")}
          </div>

          <div className={styles.settingsStyle11}>
            <div>
              <div className={styles.labelStyle}>
                {t("account.currentPassword")}
              </div>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("account.enterCurrentPassword")}
                className={styles.inputStyle}
              />
            </div>

            <div>
              <div className={styles.labelStyle}>
                {t("account.newPassword")}
              </div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("account.enterNewPassword")}
                className={styles.inputStyle}
              />
            </div>

            <div>
              <div className={styles.labelStyle}>
                {t("account.confirmNewPassword")}
              </div>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder={t("account.confirmNewPasswordPlaceholder")}
                className={styles.inputStyle}
              />
            </div>
          </div>

          <div className={styles.settingsStyle12}>
            <button
              type="button"
              onClick={handleChangePassword}
              className={styles.primaryBtn}
            >
              {t("account.changePassword")}
            </button>
          </div>

          {passwordMessage && (
            <div
              style={{
                marginTop: "14px",
                color: passwordOk ? "#16a34a" : "#ef4444",
                fontWeight: 700,
              }}
            >
              {passwordMessage}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
