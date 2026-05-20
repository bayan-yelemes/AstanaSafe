import html
import smtplib
from email.message import EmailMessage

from ..config import (
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_USE_SSL,
    SMTP_USE_TLS,
)


def is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_FROM_EMAIL)


def build_password_reset_html(
    *,
    full_name: str | None,
    reset_url: str,
    expires_minutes: int,
) -> str:
    safe_name = html.escape(full_name or "AstanaSafe user")
    safe_url = html.escape(reset_url, quote=True)

    return f"""\
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Сброс пароля AstanaSafe</title>
  </head>
  <body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.14);">
            <tr>
              <td style="padding:28px 30px;background:linear-gradient(135deg,#2563eb,#8b5cf6);color:#ffffff;">
                <div style="font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;opacity:.86;">AstanaSafe</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.18;font-weight:900;">Восстановление доступа</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Здравствуйте, <strong>{safe_name}</strong>.</p>
                <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#334155;">Мы получили запрос на смену пароля для вашего аккаунта. Нажмите кнопку ниже, чтобы задать новый пароль в безопасном окне AstanaSafe.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border-radius:14px;background:#2563eb;">
                      <a href="{safe_url}" target="_blank" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:900;font-size:15px;border-radius:14px;">Сменить пароль</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#64748b;">Ссылка действует {expires_minutes} минут. Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
                <div style="margin-top:22px;padding:16px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:13px;line-height:1.55;">
                  Если кнопка не открывается, скопируйте эту ссылку в браузер:<br>
                  <a href="{safe_url}" target="_blank" style="color:#1d4ed8;word-break:break-all;">{safe_url}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def send_password_reset_email(
    *,
    to_email: str,
    full_name: str | None,
    reset_url: str,
    expires_minutes: int,
) -> bool:
    if not is_smtp_configured():
        print(
            "SMTP is not configured. Password reset link for "
            f"{to_email}: {reset_url}"
        )
        return False

    message = EmailMessage()
    message["Subject"] = "Сброс пароля AstanaSafe"
    message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
    message["To"] = to_email

    text_body = (
        f"Здравствуйте, {full_name or 'AstanaSafe user'}.\n\n"
        "Мы получили запрос на смену пароля для вашего аккаунта.\n"
        f"Откройте ссылку и задайте новый пароль: {reset_url}\n\n"
        f"Ссылка действует {expires_minutes} минут. "
        "Если вы не запрашивали сброс, проигнорируйте это письмо."
    )
    message.set_content(text_body)
    message.add_alternative(
        build_password_reset_html(
            full_name=full_name,
            reset_url=reset_url,
            expires_minutes=expires_minutes,
        ),
        subtype="html",
    )

    smtp_class = smtplib.SMTP_SSL if SMTP_USE_SSL else smtplib.SMTP
    with smtp_class(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        if SMTP_USE_TLS and not SMTP_USE_SSL:
            server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)

    return True
