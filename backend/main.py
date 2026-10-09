import io
import os
import shutil
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from PIL import Image, ImageOps

from backend.database import init_db, get_session
from backend.models import Animal, Observation, Badge
from backend.seed import seed_species, seed_badges
from backend.services.bioclip_service import bioclip

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

_WEBP_QUALITY = 82
_MAX_SIZE = (1600, 1200)
_THUMB_SIZE = (300, 300)


def _compress_image(image_bytes: bytes, filename_base: str) -> tuple[str, str, str, str]:
    """Compress image to WebP and generate square thumbnail.

    Returns:
        (main_fs_path, thumb_fs_path, main_url, thumb_url)
    """
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")

    # Resize main image while keeping aspect ratio
    img.thumbnail(_MAX_SIZE, Image.LANCZOS)
    main_name = filename_base + ".webp"
    main_fs = os.path.join(UPLOAD_DIR, main_name)
    img.save(main_fs, "WEBP", quality=_WEBP_QUALITY)

    # Square thumbnail via centre-crop
    thumb = ImageOps.fit(img, _THUMB_SIZE, Image.LANCZOS)
    thumb_name = filename_base + "_thumb.webp"
    thumb_fs = os.path.join(UPLOAD_DIR, thumb_name)
    thumb.save(thumb_fs, "WEBP", quality=_WEBP_QUALITY)

    return main_fs, thumb_fs, f"/uploads/{main_name}", f"/uploads/{thumb_name}"


def _obs_to_dict(obs: "Observation") -> dict:
    return {
        "id": obs.id,
        "animal_id": obs.animal_id,
        "timestamp": obs.timestamp.isoformat() if obs.timestamp else None,
        "latitude": obs.latitude,
        "longitude": obs.longitude,
        "image_path": obs.image_path,
        "thumbnail_path": obs.thumbnail_path,
        "notes": obs.notes,
        "confidence": obs.confidence,
        "is_wild": obs.is_wild,
    }

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.on_event("startup")
def on_startup():
    init_db()
    from backend.database import engine
    with Session(engine) as session:
        json_path = os.path.join(os.path.dirname(__file__), "data", "species_benelux.json")
        if os.path.exists(json_path):
            seed_species(session)
            seed_badges(session)
        else:
            animals = session.exec(select(Animal)).all()
            if not animals or len(animals) < 6:
                for a in animals:
                    session.delete(a)
                session.commit()
                _seed_fallback_animals(session)
            badges = session.exec(select(Badge)).all()
            if not badges:
                seed_badges(session)

        # BioCLIP in background-thread laden (niet-blokkerend)
        all_animals = session.exec(select(Animal)).all()
    bioclip.load_in_background(all_animals)

def _seed_fallback_animals(session: Session):
    default_animals = [
        Animal(
            scientific_name="Vulpes vulpes",
            dutch_name="Rode Vos",
            category="Zoogdieren",
            rarity="Common",
            description="Een middelgrote roofdier uit de hondenfamilie met een opvallende roodachtige vacht en pluizige staart.",
            image_url="/uploads/default_fox.jpg",
            extra_info={
                "habitat": "Bossen, duinen, stedelijk gebied",
                "diet": "Alleseter (knaagdieren, konijnen, vruchten, insecten)",
                "size": "60-90 cm (staart 30-50 cm)",
                "reproduction": "Paartijd in winter, 3-6 jongen per nest (welpen)",
                "status_bedreiging": "Niet bedreigd (LC)"
            }
        ),
        Animal(
            scientific_name="Capreolus capreolus",
            dutch_name="Ree",
            category="Zoogdieren",
            rarity="Common",
            description="Een kleine esdoornhertachtige die vaak voorkomt in bosrijke gebieden en open velden.",
            image_url="/uploads/default_roe.jpg",
            extra_info={
                "habitat": "Bossen en randen van landbouwgrond",
                "diet": "Bladeren, knoppen, kruiden en jonge scheuten",
                "size": "95-135 cm (schofthoogte 60-75 cm)",
                "reproduction": "Bronsttijd in juli/augustus, 1-3 kalfjes in mei",
                "status_bedreiging": "Niet bedreigd (LC)"
            }
        ),
        Animal(
            scientific_name="Asio otus",
            dutch_name="Ransuil",
            category="Vogels",
            rarity="Rare",
            description="Een middelgrote uil met opvallende oorkuiven en oranjegele ogen.",
            image_url="/uploads/default_owl.jpg",
            extra_info={
                "habitat": "Nabij open jachtterreinen en bosjes of naaldbossen",
                "diet": "Voornamelijk muizen en kleine knaagdieren",
                "size": "31-37 cm (spanwijdte 90-100 cm)",
                "reproduction": "Legsel van 4-6 eieren, broedseizoen vanaf maart",
                "status_bedreiging": "Niet bedreigd (LC)"
            }
        ),
        Animal(
            scientific_name="Alcedo atthis",
            dutch_name="IJsvogel",
            category="Vogels",
            rarity="Epic",
            description="Een kleine, fel gekleurde vogel met kobaltblauwe en oranjeveren die jaagt op vis in helder water.",
            image_url="/uploads/default_kingfisher.jpg",
            extra_info={
                "habitat": "Stromend zoet water, meren en kanalen met schuilplekken",
                "diet": "Kleine visjes, waterinsecten en kreeftachtigen",
                "size": "16-17 cm (spanwijdte 24-26 cm)",
                "reproduction": "2-3 legsel per jaar van 6-7 eieren in steile oeverwallen",
                "status_bedreiging": "Gevoelig / Beschermd"
            }
        ),
        Animal(
            scientific_name="Meles meles",
            dutch_name="Das",
            category="Zoogdieren",
            rarity="Rare",
            description="Een robuust roofdier met kenmerkende zwart-witte strepen op de kop en een krachtige graver.",
            image_url="/uploads/default_badger.jpg",
            extra_info={
                "habitat": "Loof- en gemengde bossen met nabijgelegen weilanden",
                "diet": "Regenwormen, insecten, knollen en eikels",
                "size": "65-80 cm (gewicht tot 15 kg)",
                "reproduction": "Paartijd in zomer, 2-5 jongen in het voorjaar",
                "status_bedreiging": "Niet bedreigd (LC)"
            }
        ),
        Animal(
            scientific_name="Buteo buteo",
            dutch_name="Buizerd",
            category="Vogels",
            rarity="Common",
            description="Een middelgrote roofvogel met brede vleugels en een korte afgeronde staart die vaak op paaltjes loert.",
            image_url="/uploads/default_buzzard.jpg",
            extra_info={
                "habitat": "Open landschappen afgewisseld met bos",
                "diet": "Knaagdieren, kleine zoogdieren en reptielen",
                "size": "50-57 cm (spanwijdte 113-128 cm)",
                "reproduction": "Legsel van 2-3 eieren in hoge bomen",
                "status_bedreiging": "Niet bedreigd (LC)"
            }
        )
    ]
    for a in default_animals:
        session.add(a)
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
    elif "das" in filename or "badger" in filename:
        return {"scientific_name": "Meles meles", "confidence": 0.93}
    elif "buiz" in filename or "buzzard" in filename:
        return {"scientific_name": "Buteo buteo", "confidence": 0.92}
    else:
        return {"scientific_name": "Vulpes vulpes", "confidence": 0.96}

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "BioLoggr API",
        "bioclip": "ready" if bioclip.is_ready else ("loading" if bioclip.is_loading else "unavailable"),
    }

@app.post("/api/identify")
async def identify_image(file: UploadFile = File(...)):
    """
    Identificeer een soort op basis van een foto.
    Retourneert top-3 AI-suggesties ZONDER een waarneming op te slaan.
    """
    if bioclip.load_error:
        return {"status": "error", "message": bioclip.load_error, "suggestions": []}
    if not bioclip.is_ready:
        return {"status": "loading", "message": "AI-model wordt geladen…", "suggestions": []}

    image_bytes = await file.read()
    suggestions = bioclip.predict(image_bytes, top_k=3)
    return {"status": "ready", "suggestions": suggestions}

@app.get("/api/codex")
def get_codex(session: Session = Depends(get_session)):
    animals = session.exec(select(Animal)).all()
    result = []
    for animal in animals:
        statement = select(Observation).where(Observation.animal_id == animal.id).order_by(Observation.timestamp.desc())
        latest_obs = session.exec(statement).first()
        
        result.append({
            "id": animal.id,
            "scientific_name": animal.scientific_name,
            "dutch_name": animal.dutch_name,
            "category": animal.category,
            "rarity": animal.rarity,
            "description": animal.description,
            "image_url": animal.image_url,
            "extra_info": animal.extra_info,
            "latest_observation": _obs_to_dict(latest_obs) if latest_obs else None,
        })
    return result

@app.get("/api/codex/{animal_id}")
def get_animal_detail(animal_id: int, session: Session = Depends(get_session)):
    animal = session.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    all_obs = session.exec(
        select(Observation)
        .where(Observation.animal_id == animal.id)
        .order_by(Observation.timestamp.desc())
    ).all()

    latest_obs = all_obs[0] if all_obs else None

    return {
        "id": animal.id,
        "scientific_name": animal.scientific_name,
        "dutch_name": animal.dutch_name,
        "category": animal.category,
        "rarity": animal.rarity,
        "description": animal.description,
        "image_url": animal.image_url,
        "extra_info": animal.extra_info,
        "latest_observation": _obs_to_dict(latest_obs) if latest_obs else None,
        "all_observations": [_obs_to_dict(o) for o in all_obs],
    }

@app.post("/api/observations")
async def create_observation(
    file: UploadFile = File(...),
    latitude: Optional[float] = Query(None, description="Latitude of observation"),
    longitude: Optional[float] = Query(None, description="Longitude of observation"),
    notes: Optional[str] = None,
    is_wild: bool = Query(True, description="True = in het wild, False = dierentuin/opvang"),
    animal_id: Optional[int] = Query(None, description="Door gebruiker bevestigde soort-ID (van /identify)"),
    match_score: Optional[float] = Query(None, description="Betrouwbaarheidsscore (0.0-1.0) zoals getoond bij identificatie"),
    session: Session = Depends(get_session)
):
    # Bestand lezen + comprimeren naar WebP
    image_bytes = await file.read()
    original_name = (file.filename or "upload.jpg").replace(" ", "_")
    name_no_ext = os.path.splitext(original_name)[0]
    filename_base = f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{name_no_ext}"
    try:
        main_fs, thumb_fs, image_url, thumbnail_url = _compress_image(image_bytes, filename_base)
    except Exception:
        raise HTTPException(status_code=422, detail="Afbeelding kon niet worden verwerkt. Zorg dat je een geldig JPEG/PNG/WebP-bestand uploadt.")
    file_path = main_fs

    # Soort bepalen: gebruiker-keuze > BioCLIP > mock-fallback
    if animal_id is not None:
        animal = session.get(Animal, animal_id)
        if not animal:
            raise HTTPException(status_code=404, detail="Dier niet gevonden")
        # Gebruik de meegestuurde score exact zoals getoond in de UI (geen herberekening)
        if match_score is not None:
            confidence = float(match_score)
        elif bioclip.is_ready:
            results = bioclip.predict(image_bytes, top_k=3)
            match = next((r for r in results if r["animal_id"] == animal_id), None)
            confidence = match["confidence"] if match else results[0]["confidence"] if results else 0.99
        else:
            confidence = 0.99
    elif bioclip.is_ready:
        results = bioclip.predict(image_bytes, top_k=1)
        if results:
            top = results[0]
            animal = session.get(Animal, top["animal_id"])
            confidence = top["confidence"]
        else:
            animal = session.exec(select(Animal)).first()
            confidence = 0.5
    else:
        # Mock-fallback als BioCLIP nog niet klaar is
        ai_result = mock_identify_animal(file_path)
        sci_name = ai_result["scientific_name"]
        confidence = ai_result["confidence"]
        animal = session.exec(select(Animal).where(Animal.scientific_name == sci_name)).first()
        if not animal:
            animal = session.exec(select(Animal)).first()
        
    observation = Observation(
        animal_id=animal.id,
        latitude=latitude,
        longitude=longitude,
        image_path=image_url,
        thumbnail_path=thumbnail_url,
        confidence=confidence,
        notes=notes,
        is_wild=is_wild
    )
    
    session.add(observation)
    session.commit()
    session.refresh(observation)
    
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
        "observation": _obs_to_dict(observation),
        "animal": {
            "id": animal.id,
            "scientific_name": animal.scientific_name,
            "dutch_name": animal.dutch_name,
            "category": animal.category,
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


@app.delete("/api/observations/{observation_id}")
def delete_observation(observation_id: int, session: Session = Depends(get_session)):
    obs = session.get(Observation, observation_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Waarneming niet gevonden")

    # Verwijder gekoppelde bestanden van de schijf
    for url_path in [obs.image_path, obs.thumbnail_path]:
        if url_path:
            fs_path = os.path.join(UPLOAD_DIR, os.path.basename(url_path))
            if os.path.exists(fs_path):
                os.remove(fs_path)

    session.delete(obs)
    session.commit()

    return {"ok": True, "deleted_id": observation_id}


@app.get("/api/badges", response_model=List[Badge])
def get_badges(session: Session = Depends(get_session)):
    badges = session.exec(select(Badge)).all()
    return badges
