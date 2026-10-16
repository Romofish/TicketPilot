from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class OpenSession(BaseModel):
    model_config = ConfigDict(extra="forbid")
    platform: Literal["allticket", "ttm"] = "allticket"
    url: str = Field(min_length=1, max_length=2048)
    event_name: str = Field(default="", max_length=120)


class Marker(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: Literal["T1", "T2", "T3"]
