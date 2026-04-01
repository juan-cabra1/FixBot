# app/routers/settings.py — Business config and availability endpoints
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.availability import Availability
from app.models.business import BusinessConfig
from app.schemas.settings import (
    AvailabilityBlock,
    AvailabilityUpdate,
    SettingsResponse,
    SettingsUpdate,
)

router = APIRouter(
    prefix="/api/v1/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)


async def _get_config(db: AsyncSession) -> BusinessConfig:
    result = await db.execute(select(BusinessConfig).limit(1))
    config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return config


@router.get("", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)) -> SettingsResponse:
    config = await _get_config(db)
    return SettingsResponse.model_validate(config)


@router.put("", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    config = await _get_config(db)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)
    return SettingsResponse.model_validate(config)


@router.get("/availability", response_model=list[AvailabilityBlock])
async def get_availability(db: AsyncSession = Depends(get_db)) -> list[AvailabilityBlock]:
    result = await db.execute(
        select(Availability).order_by(Availability.day_of_week, Availability.start_time)
    )
    blocks = result.scalars().all()
    return [AvailabilityBlock.model_validate(b) for b in blocks]


@router.put("/availability", response_model=list[AvailabilityBlock])
async def update_availability(
    body: AvailabilityUpdate,
    db: AsyncSession = Depends(get_db),
) -> list[AvailabilityBlock]:
    # Replace all blocks
    await db.execute(delete(Availability))

    new_blocks: list[Availability] = []
    for block in body.blocks:
        row = Availability(
            day_of_week=block.day_of_week,
            start_time=block.start_time,
            end_time=block.end_time,
            is_active=block.is_active,
        )
        db.add(row)
        new_blocks.append(row)

    await db.commit()
    for row in new_blocks:
        await db.refresh(row)

    return [AvailabilityBlock.model_validate(row) for row in new_blocks]
