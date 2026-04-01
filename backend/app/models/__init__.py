# app/models/__init__.py — Import all models and expose Base
from app.models.base import Base
from app.models.business import BusinessConfig
from app.models.service import Service
from app.models.availability import Availability
from app.models.client import Client
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.appointment import Appointment
from app.models.quote import Quote
from app.models.reminder import Reminder

__all__ = [
    "Base",
    "BusinessConfig",
    "Service",
    "Availability",
    "Client",
    "Conversation",
    "Message",
    "Appointment",
    "Quote",
    "Reminder",
]
