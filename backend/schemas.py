
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LeadStatus = Literal[
    "New",
    "Contacted",
    "Interested",
    "Converted",
    "Lost",
]


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    company: str | None = Field(default=None, max_length=150)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    status: LeadStatus = "New"
    notes: str | None = None
    assigned_to: int | None = None
    client_user_id: int | None = None



class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    company: str | None = Field(default=None, max_length=150)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    status: LeadStatus | None = None
    notes: str | None = None
    assigned_to: int | None = None
    client_user_id: int | None = None



class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    company: str | None
    email: str | None
    phone: str | None
    status: str
    notes: str | None
    created_at: datetime
    assigned_to: int | None
    client_user_id: int | None

