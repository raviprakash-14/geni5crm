
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


FollowUpStatus = Literal["Pending", "Completed"]


class FollowUpCreate(BaseModel):
    lead_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    due_at: datetime
    notes: str | None = None


class FollowUpUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    due_at: datetime | None = None
    notes: str | None = None
    status: FollowUpStatus | None = None


class FollowUpResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lead_id: int
    title: str
    due_at: datetime
    notes: str | None
    status: str
    created_at: datetime
