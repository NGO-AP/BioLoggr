import os
import shutil
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from backend.database import init_db, get_session
from backend.models import Animal, Observation, Badge

app = FastAPI(title="BioLoggr API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("backend/static", exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.on_event("startup")
def on_startup():
    init_db()
    # Seed initial data if empty
    from backend.database import engine
    with Session(engine) as session:
        animal_count = session.exec(select(Animal)).first()
        if not animal_count:
            seed_animals(session)
            seed_badges(session)

def seed_animals(session: Session):
    default_animals = [
        Animal(
            scientific_name="Vulpes vulpes",
            dutch_name="Rode Vos",
            rarity="Common",
            description="Een middelgrote roofdier uit de hondenfamilie met een opvallende roodachtige vacht en pluizige staart.",
            image_url="/uploads/default_fox.jpg",
            extra_info={"habitat": "Bossen, duinen, stedelijk gebied", "diet": "Alleseter", "size": "60-90 cm"}
        ),
        Animal(
            scientific_name="Capreolus capreolus",
            dutch_name="Ree",
            rarity="Common",
            description="Een kleine esdoornhertachtige die vaak voorkomt in bosrijke gebieden en open velden.",
            image_url="/uploads/default_roe.jpg",
            extra_info={"habitat": "Bossen en randen van landbouwgrond", "diet": "Plantaardig", "size": "95-135 cm"}
        ),
        Animal(
            scientific_name="Asio otus",
            dutch_name="Ransuil",
            rarity="Rare",
            description="Een middelgrote uil met opvallende oorkuiven en oranjegele ogen.",
            image_url="/uploads/default_owl.jpg",
            extra_info={"habitat": "Nabij open jachtterreinen en bosjes", "diet": "Knaagdieren", "size": "31-37 cm"}
        ),
        Animal(
            scientific_name="Alcedo atthis",
            dutch_name="IJsvogel",
            rarity="Epic",
            description="Een kleine, fel gekleurde vogel met kobaltblauwe en oranjeveren die jaagt op vis in helder water.",
            image_url="/uploads/default_kingfisher.jpg",
            extra_info={"habitat": "Stromend zoet water", "diet": "Vis en waterinsecten", "size": "16-17 cm"}
        )
    ]
    for a in default_animals:
        session.add(a)
    session.commit()

def seed_badges(session: Session):
    default_badges = [
        Badge(name="Eerste Waarneming", description="Registreer je aller eerste dier in de codex.", icon="🏆", unlocked_at=None),
        Badge(name="Nachtvlinder", description="Vind een zeldzaam dier 's avonds of 's nachts.", icon="🌙", unlocked_at=None),
        Badge(name="Boswachter", description="Ontdek alle algemene dieren in je lokale omgeving.", icon="🌲", unlocked_at=None)
    ]
    for b in default_badges:
        session.add(b)
    session.commit()

# Mock AI Service for Animal Identification
def mock_identify_animal(image_path: str):
    filename = os.path.basename(image_path).lower()
    if "ijs" in filename or "king" in filename:
        return {"scientific_name": "Alcedo atthis", "confidence": 0.94}
    elif "uil" in filename or "owl" in filename:
        return {"scientific_name": "Asio otus", "confidence": 0.89}
    elif "ree" in filename or "roe" in filename:
        return {"scientific_name": "Capreolus capreolus", "confidence": 0.91}
    else:
        return {"scientific_name": "Vulpes vulpes", "confidence": 0.96}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "BioLoggr API"}

@app.get("/api/codex", response_model=List[Animal])
def get_codex(session: Session = Depends(get_session)):
    animals = session.exec(select(Animal)).all()
    return animals

@app.get("/api/codex/{animal_id}", response_model=Animal)
def get_animal_detail(animal_id: int, session: Session = Depends(get_session)):
    animal = session.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    return animal

@app.post("/api/observations")
async def create_observation(
    file: UploadFile = File(...),
    latitude: float = Query(51.2194, description="Latitude of observation"),
    longitude: float = Query(4.4025, description="Longitude of observation"),
    notes: Optional[str] = None,
    session: Session = Depends(get_session)
):
    # Save uploaded file locally
    file_extension = os.path.splitext(file.filename)[1]
    saved_filename = f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Run mock AI identification
    ai_result = mock_identify_animal(file_path)
    sci_name = ai_result["scientific_name"]
    confidence = ai_result["confidence"]
    
    # Find animal in database
    animal = session.exec(select(Animal).where(Animal.scientific_name == sci_name)).first()
    if not animal:
        animal = session.exec(select(Animal)).first()
        
    observation = Observation(
        animal_id=animal.id,
        latitude=latitude,
        longitude=longitude,
        image_path=f"/uploads/{saved_filename}",
        confidence=confidence,
        notes=notes
    )
    
    session.add(observation)
    session.commit()
    session.refresh(observation)
    
    # Check and unlock first observation badge if applicable
    badges = session.exec(select(Badge)).all()
    unlocked_badges = []
    for badge in badges:
        if badge.name == "Eerste Waarneming" and not badge.unlocked_at:
            badge.unlocked_at = datetime.now(timezone.utc)
            session.add(badge)
            session.commit()
            session.refresh(badge)
            unlocked_badges.append(badge)

    return {
        "observation": {
            "id": observation.id,
            "animal_id": observation.animal_id,
            "latitude": observation.latitude,
            "longitude": observation.longitude,
            "image_path": observation.image_path,
            "timestamp": observation.timestamp.isoformat() if observation.timestamp else None,
            "confidence": observation.confidence,
            "notes": observation.notes
        },
        "animal": {
            "id": animal.id,
            "scientific_name": animal.scientific_name,
            "dutch_name": animal.dutch_name,
            "rarity": animal.rarity,
            "description": animal.description,
            "image_url": animal.image_url,
            "extra_info": animal.extra_info
        },
        "badges": unlocked_badges
    }

@app.get("/api/observations", response_model=List[Observation])
def get_observations(session: Session = Depends(get_session)):
    observations = session.exec(select(Observation)).all()
    return observations

@app.get("/api/badges", response_model=List[Badge])
def get_badges(session: Session = Depends(get_session)):
    badges = session.exec(select(Badge)).all()
    return badges
