from typing import Optional, Dict, Any, List
from sqlmodel import SQLModel, Field, Column, JSON, Relationship
from sqlalchemy import DateTime
from datetime import datetime, timezone

class Animal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scientific_name: str = Field(index=True)
    dutch_name: str = Field(index=True)
    category: str = Field(default="Zoogdieren") # Zoogdieren, Vogels, etc.
    rarity: str = Field(default="Common") # Common, Rare, Epic, Legendary
    description: str
    image_url: Optional[str] = None
    extra_info: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    
    observations: List["Observation"] = Relationship(back_populates="animal")

class Observation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    animal_id: int = Field(foreign_key="animal.id")
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    image_path: str
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True))
    )
    confidence: float
    notes: Optional[str] = None
    is_wild: bool = Field(default=True)
    thumbnail_path: Optional[str] = None
    iso: Optional[int] = None
    aperture: Optional[float] = None
    focal_length: Optional[float] = None
    shutter_speed: Optional[str] = None

    animal: Optional[Animal] = Relationship(back_populates="observations")

class Badge(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str
    icon: str
    unlocked_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))

class BadgeUnlock(SQLModel, table=True):
    """Persistent timestamp registry for the dynamic badge system."""
    id: Optional[int] = Field(default=None, primary_key=True)
    badge_id: str = Field(index=True, unique=True)
    unlocked_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True))
    )
