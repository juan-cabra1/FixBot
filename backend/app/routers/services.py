# app/routers/services.py — Services CRUD
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.service import Service
from app.schemas.service import ServiceCreate, ServiceResponse, ServiceUpdate

router = APIRouter(
    prefix="/api/v1/services",
    tags=["services"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[ServiceResponse])
async def list_services(
    db: AsyncSession = Depends(get_db),
) -> list[ServiceResponse]:
    result = await db.execute(
        select(Service).where(Service.is_active.is_(True)).order_by(Service.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    body: ServiceCreate,
    db: AsyncSession = Depends(get_db),
) -> ServiceResponse:
    service = Service(
        name=body.name,
        description=body.description,
        price=body.price,
        currency=body.currency,
        duration_minutes=body.duration_minutes,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service


@router.patch("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: int,
    body: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
) -> ServiceResponse:
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if service is None:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(service, field, value)

    await db.commit()
    await db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if service is None:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    service.is_active = False
    await db.commit()
