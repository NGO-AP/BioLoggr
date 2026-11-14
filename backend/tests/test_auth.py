import pytest
from fastapi.testclient import TestClient

from backend import auth
from tests.conftest import TEST_PASSWORD, TEST_SECRET


def test_login_success_returns_token(client: TestClient):
    response = client.post("/api/auth/login", json={"password": TEST_PASSWORD})
    assert response.status_code == 200
    assert auth.is_token_valid(response.json()["token"], TEST_SECRET)


def test_login_wrong_password(client: TestClient):
    response = client.post("/api/auth/login", json={"password": "fout"})
    assert response.status_code == 401


def test_login_not_configured_fails_closed(client: TestClient, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD")
    response = client.post("/api/auth/login", json={"password": ""})
    assert response.status_code == 503


def test_verify_with_valid_token(client: TestClient, auth_headers):
    response = client.get("/api/auth/verify", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"valid": True}


def test_verify_without_token(client: TestClient):
    assert client.get("/api/auth/verify").status_code == 401


def test_verify_rejects_tampered_token(client: TestClient, auth_headers):
    token = auth_headers["Authorization"].removeprefix("Bearer ")
    body, signature = token.split(".")
    forged = {"Authorization": f"Bearer {body}.{signature[:-2]}xx"}
    assert client.get("/api/auth/verify", headers=forged).status_code == 401


def test_verify_rejects_token_signed_with_other_key(client: TestClient):
    token = auth.create_token("andere-sleutel")
    response = client.get("/api/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_verify_rejects_expired_token(client: TestClient):
    token = auth.create_token(TEST_SECRET, ttl_seconds=-10)
    response = client.get("/api/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


@pytest.mark.parametrize("garbage", ["", "abc", "a.b", "...."])
def test_verify_rejects_garbage_token(client: TestClient, garbage):
    response = client.get("/api/auth/verify", headers={"Authorization": f"Bearer {garbage}"})
    assert response.status_code == 401


@pytest.mark.parametrize(
    "method, path",
    [
        ("post", "/api/identify"),
        ("post", "/api/observations"),
        ("delete", "/api/observations/1"),
    ],
)
def test_protected_endpoints_require_token(client: TestClient, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 401


@pytest.mark.parametrize(
    "path",
    ["/api/health", "/api/codex", "/api/observations", "/api/badges", "/api/stats"],
)
def test_read_endpoints_are_public(client: TestClient, path):
    assert client.get(path).status_code == 200


def _fail_logins(client: TestClient, count: int) -> None:
    for _ in range(count):
        assert client.post("/api/auth/login", json={"password": "fout"}).status_code == 401


def test_login_is_rate_limited_after_max_failures(client: TestClient):
    _fail_logins(client, auth.MAX_FAILED_ATTEMPTS)

    blocked = client.post("/api/auth/login", json={"password": "fout"})
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0

    # Ook het juiste wachtwoord wordt tijdens de blokkade geweigerd.
    assert client.post("/api/auth/login", json={"password": TEST_PASSWORD}).status_code == 429


def test_failures_below_limit_do_not_block(client: TestClient):
    _fail_logins(client, auth.MAX_FAILED_ATTEMPTS - 1)
    assert client.post("/api/auth/login", json={"password": TEST_PASSWORD}).status_code == 200


def test_successful_login_resets_failure_counter(client: TestClient):
    _fail_logins(client, auth.MAX_FAILED_ATTEMPTS - 1)
    assert client.post("/api/auth/login", json={"password": TEST_PASSWORD}).status_code == 200
    _fail_logins(client, auth.MAX_FAILED_ATTEMPTS - 1)


def test_rate_limit_expires_after_window(client: TestClient, monkeypatch):
    _fail_logins(client, auth.MAX_FAILED_ATTEMPTS)
    assert client.post("/api/auth/login", json={"password": "fout"}).status_code == 429

    real_monotonic = auth.time.monotonic
    monkeypatch.setattr(auth.time, "monotonic", lambda: real_monotonic() + auth.ATTEMPT_WINDOW_SECONDS + 1)
    assert client.post("/api/auth/login", json={"password": TEST_PASSWORD}).status_code == 200
