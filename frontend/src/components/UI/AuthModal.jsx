import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import {
  loginUser,
  registerUser,
  requestPasswordReset,
} from "../../services/authService";
import { reportError } from "../../utils/logger";
import { X } from "./icons";
import { useI18n } from "../../i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./AuthModal.module.css";

export default function AuthModal({ open, onClose }) {
  const { t } = useI18n();
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);

  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setError("");
    setNotice("");

    if (mode === "forgot") {
      if (!emailOrPhone.trim() || !emailOrPhone.includes("@")) {
        setError(t("auth.emailRequiredForReset"));
        return;
      }

      try {
        setSubmitting(true);
        await requestPasswordReset(emailOrPhone);
        setNotice(t("auth.resetEmailSent"));
        setPassword("");
      } catch (error) {
        reportError("Failed to request password reset:", error);
        setError(error?.response?.data?.detail || t("auth.resetSendError"));
      } finally {
        setSubmitting(false);
      }

      return;
    }

    if (!emailOrPhone.trim() || !password.trim()) {
      setError(t("auth.fillRequired"));
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        setError(t("auth.enterName"));
        return;
      }

      try {
        setSubmitting(true);
        const user = await registerUser({
          name,
          emailOrPhone,
          password: password.trim(),
        });

        setCurrentUser(user);
        closeAndReset();
      } catch (error) {
        reportError("Failed to register user:", error);
        setError(error?.response?.data?.detail || t("auth.accountExists"));
      } finally {
        setSubmitting(false);
      }

      return;
    }

    if (mode === "signin") {
      try {
        setSubmitting(true);
        const user = await loginUser({
          emailOrPhone,
          password: password.trim(),
        });

        setCurrentUser(user);
        closeAndReset();
      } catch (error) {
        reportError("Failed to login user:", error);
        setError(t("auth.wrongCredentials"));
      } finally {
        setSubmitting(false);
      }
    }
  };

  const closeAndReset = () => {
    onClose();
    setName("");
    setEmailOrPhone("");
    setPassword("");
    setError("");
    setNotice("");
    setSubmitting(false);
    setMode("signin");
  };

  const handleGoogleSignIn = () => {
    setError(t("auth.googleUnavailable"));
    setNotice("");
  };

  return (
    <div
      className={["modal-backdrop", styles.authModalStyle1]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={["motion-modal", styles.authModalStyle2]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.headerRow}>
          <h2 className={styles.authModalStyle3}>
            {mode === "signin"
              ? t("auth.signIn")
              : mode === "forgot"
                ? t("auth.resetPassword")
                : t("auth.signUp")}
          </h2>

          <LanguageSwitcher />
        </div>

        <p className={styles.subtitle}>
          {mode === "signin"
            ? t("auth.signInSubtitle")
            : mode === "forgot"
              ? t("auth.resetPasswordSubtitle")
              : t("auth.signUpSubtitle")}
        </p>

        {mode === "signup" && (
          <>
            <label className={styles.fieldLabel}>
              {t("auth.fullName")}
              <input
                type="text"
                placeholder={t("auth.yourName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.inputStyle}
              />
            </label>
          </>
        )}

        <label className={styles.fieldLabel}>
          {mode === "forgot"
            ? t("auth.emailLabel")
            : t("auth.emailOrPhoneLabel")}
          <input
            type={mode === "forgot" ? "email" : "text"}
            placeholder={
              mode === "forgot"
                ? t("auth.emailOnlyPlaceholder")
                : t("auth.emailPhone")
            }
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            className={styles.inputStyle}
          />
        </label>

        {mode !== "forgot" && (
          <label className={styles.fieldLabel}>
            {t("auth.password")}
            <input
              type="password"
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.inputStyle}
            />
          </label>
        )}

        {mode === "signin" && (
          <div className={styles.forgotRow}>
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
                setNotice("");
                setPassword("");
              }}
              className={styles.linkButton}
            >
              {t("auth.forgotPassword")}
            </button>
          </div>
        )}

        {error && <div className={styles.authModalStyle4}>{error}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={styles.primaryBtn}
        >
          {submitting
            ? t("auth.submitting")
            : mode === "signin"
              ? t("auth.signIn")
              : mode === "forgot"
                ? t("auth.sendResetLink")
                : t("auth.createAccount")}
        </button>

        {mode !== "forgot" && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className={styles.googleBtn}
          >
            {t("auth.continueGoogle")}
          </button>
        )}

        <div className={styles.authModalStyle5}>
          {mode === "forgot"
            ? t("auth.rememberPassword")
            : mode === "signin"
              ? t("auth.noAccount")
              : t("auth.hasAccount")}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setNotice("");
            }}
            className={styles.authModalStyle6}
          >
            {mode === "signin" ? t("auth.signUp") : t("auth.signIn")}
          </button>
        </div>

        <button type="button" onClick={closeAndReset} className={styles.closeBtn}>
          <X size={16} />
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
