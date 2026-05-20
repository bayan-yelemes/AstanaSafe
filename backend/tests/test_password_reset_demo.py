from app.routers import auth


def test_build_password_reset_url_uses_frontend_url(monkeypatch):
    monkeypatch.setattr(auth, "FRONTEND_URL", "https://astanasafe-web.onrender.com/")

    reset_url = auth.build_password_reset_url("demo-token")

    assert reset_url == (
        "https://astanasafe-web.onrender.com/reset-password?token=demo-token"
    )


def test_build_password_reset_response_exposes_url_in_demo_mode(monkeypatch):
    monkeypatch.setattr(auth, "PASSWORD_RESET_DEMO_MODE", True)

    response = auth.build_password_reset_response(
        "If that email exists, a password reset link has been sent.",
        "https://astanasafe-web.onrender.com/reset-password?token=demo-token",
    )

    assert response["message"] == (
        "If that email exists, a password reset link has been sent."
    )
    assert response["reset_url"].endswith("token=demo-token")


def test_build_password_reset_response_hides_url_when_demo_mode_disabled(
    monkeypatch,
):
    monkeypatch.setattr(auth, "PASSWORD_RESET_DEMO_MODE", False)

    response = auth.build_password_reset_response(
        "If that email exists, a password reset link has been sent.",
        "https://astanasafe-web.onrender.com/reset-password?token=demo-token",
    )

    assert response == {
        "message": "If that email exists, a password reset link has been sent."
    }
