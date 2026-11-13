"""Single-user authenticatie: login met ADMIN_PASSWORD, HMAC-ondertekende tokens.

Alleen de standaardbibliotheek wordt gebruikt (hmac, hashlib, secrets).
Omgevingsvariabelen worden per aanroep gelezen, zodat tests ze kunnen aanpassen.
"""

import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
MAX_FAILED_ATTEMPTS = 5
ATTEMPT_WINDOW_SECONDS = 5 * 60

# In-memory rate limiting per client-IP (gaat verloren bij herstart; bedoeld voor één proces).
_failed_attempts: dict[str, list[float]] = {}
_attempts_lock = threading.Lock()

router = APIRouter(prefix="/api/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    password: str


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(message: str, secret_key: str) -> str:
    digest = hmac.new(secret_key.encode("utf-8"), message.encode("ascii"), hashlib.sha256).digest()
    return _b64encode(digest)


def _auth_config() -> tuple[str, str]:
    """Geef (ADMIN_PASSWORD, AUTH_SECRET_KEY); 503 als een van beide ontbreekt (fail closed)."""
    password = os.getenv("ADMIN_PASSWORD", "")
    secret_key = os.getenv("AUTH_SECRET_KEY", "")
    if not password or not secret_key:
        raise HTTPException(
            status_code=503,
            detail="Authenticatie is niet geconfigureerd (ADMIN_PASSWORD / AUTH_SECRET_KEY).",
        )
    return password, secret_key


def create_token(secret_key: str, ttl_seconds: int = TOKEN_TTL_SECONDS) -> str:
    payload = json.dumps({"sub": "admin", "exp": int(time.time()) + ttl_seconds}, separators=(",", ":"))
    body = _b64encode(payload.encode("utf-8"))
    return f"{body}.{_sign(body, secret_key)}"


def is_token_valid(token: str, secret_key: str) -> bool:
    try:
        body, signature = token.split(".", 1)
        if not secrets.compare_digest(signature.encode("utf-8"), _sign(body, secret_key).encode("utf-8")):
            return False
        payload = json.loads(_b64decode(body))
        return payload.get("sub") == "admin" and int(payload["exp"]) > time.time()
    except (ValueError, KeyError, TypeError, binascii.Error, UnicodeError):
        return False


def verify_admin(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> None:
    """FastAPI dependency: vereist een geldige `Authorization: Bearer <token>` header."""
    _, secret_key = _auth_config()
    if credentials is None or not is_token_valid(credentials.credentials, secret_key):
        raise HTTPException(
            status_code=401,
            detail="Ongeldig of verlopen token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _client_ip(request: Request) -> str:
    # Bewust géén X-Forwarded-For: die header is door de client te vervalsen.
    return request.client.host if request.client else "unknown"


def _check_not_rate_limited(ip: str) -> None:
    """429 als dit IP te veel mislukte pogingen heeft binnen het tijdvenster."""
    now = time.monotonic()
    with _attempts_lock:
        for key in list(_failed_attempts):
            recent = [t for t in _failed_attempts[key] if now - t < ATTEMPT_WINDOW_SECONDS]
            if recent:
                _failed_attempts[key] = recent
            else:
                del _failed_attempts[key]
        attempts = _failed_attempts.get(ip, [])
        if len(attempts) >= MAX_FAILED_ATTEMPTS:
            retry_after = max(1, int(ATTEMPT_WINDOW_SECONDS - (now - attempts[0])) + 1)
            raise HTTPException(
                status_code=429,
                detail="Te veel mislukte pogingen. Probeer het later opnieuw.",
                headers={"Retry-After": str(retry_after)},
            )


def _record_failed_attempt(ip: str) -> None:
    with _attempts_lock:
        _failed_attempts.setdefault(ip, []).append(time.monotonic())


@router.post("/login")
def login(body: LoginRequest, request: Request):
    password, secret_key = _auth_config()
    ip = _client_ip(request)
    _check_not_rate_limited(ip)
    if not secrets.compare_digest(body.password.encode("utf-8"), password.encode("utf-8")):
        _record_failed_attempt(ip)
        raise HTTPException(status_code=401, detail="Onjuist wachtwoord.")
    with _attempts_lock:
        _failed_attempts.pop(ip, None)
    return {"token": create_token(secret_key), "token_type": "bearer", "expires_in": TOKEN_TTL_SECONDS}


@router.get("/verify", dependencies=[Depends(verify_admin)])
def verify():
    return {"valid": True}
