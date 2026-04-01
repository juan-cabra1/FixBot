# app/models/availability.py — Weekly availability blocks
from datetime import time

from sqlalchemy import Boolean, CheckConstraint, SmallInteger, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Availability(Base):
    __tablename__ = "availability"

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="chk_day_of_week"),
        CheckConstraint("end_time > start_time", name="chk_time_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Mon, 6=Sun
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
