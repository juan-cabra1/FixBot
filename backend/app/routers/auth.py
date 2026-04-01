# app/routers/auth.py — Authentication endpoint
from fastapi import APIRouter, HTTPException, status

from app.auth import create_token, verify_password
from app.config import settings
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """Authenticate dashboard user and return JWT."""
    if body.username != settings.dashboard_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    if not settings.dashboard_password_hash or not verify_password(
        body.password, settings.dashboard_password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    token = create_token(body.username)
    return TokenResponse(access_token=token)
