
from pydantic import BaseModel, Field


class ClientAssignment(BaseModel):
    client_user_id: int | None = Field(default=None, gt=0)
