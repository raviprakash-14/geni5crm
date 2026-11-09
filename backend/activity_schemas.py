
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ActivityType = Literal["Call", "Meeting", "Email", "Note"]


class ActivityCreate(BaseModel):
    lead_id: int = Field(gt=0)
    activity_type: ActivityType
    subject: str = Field(min_length=1, max_length=200)
    description: str | None = None
    occurred_at: datetime | None = None


class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lead_id: int
    activity_type: str
    subject: str
    description: str | None
    occurred_at: datetime
    created_at: datetime
