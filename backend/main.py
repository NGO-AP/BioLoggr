import io
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select
from PIL import Image, ImageOps, ExifTags

from backend.database import init_db, get_session
from backend.models import Animal, Observation, Badge
from backend.seed import seed_species, seed_badges
from backend.services.bioclip_service import bioclip
from backend.services import badge_service
from backend.upload_storage import commit_uploads_if_configured

app = FastAPI(title="BioLoggr API", version="1.0.0")

# CORS: configureerbaar via omgevingsvariabele voor productie.
# Standaard localhost-origins voor lokale ontwikkeling.
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:4200,http://127.0.0.1:4200",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Accept"],
)

UPLOAD_DIR = "backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("backend/static", exist_ok=True)

_WEBP_QUALITY = 82
_MAX_SIZE = (1600, 1200)
_THUMB_SIZE = (300, 300)


_ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"}


def _safe_filename_base(original_filename: str | None) -> str:
    """Genereer een veilige bestandsnaam-basis met UUID.

    De originele bestandsnaam van de gebruiker wordt NOOIT direct gebruikt
    om directory traversal (../../) en injectie-aanvallen te voorkomen.
    """
    ext = ""
    if original_filename:
        _, raw_ext = os.path.splitext(original_filename)
        if raw_ext.lower() in _ALLOWED_IMAGE_EXTENSIONS:
            ext = raw_ext.lower()
    return uuid.uuid4().hex + (ext or ".jpg")


def _validate_image(image_bytes: bytes) -> None:
    """Controleer via Pillow of de bytes een geldig afbeeldingsbestand vormen.

    Gooit een HTTPException als het bestand ongeldig of corrupt is.
    """
    try:
        probe = Image.open(io.BytesIO(image_bytes))
        probe.verify()  # Detecteert corrupte of nep-bestanden
    except Exception:
        raise HTTPException(
            status_code=422,
            detail="Geen geldig afbeeldingsbestand. Zorg dat je een JPEG, PNG of WebP uploadt.",
        )


_EXIF_TAG_NAME_TO_ID = {v: k for k, v in ExifTags.TAGS.items()}


def _rational_to_float(value) -> float | None:
    if value is None:
        return None
    try:
        if hasattr(value, "numerator") and hasattr(value, "denominator"):
            if value.denominator == 0:
                return None
            return float(value.numerator) / float(value.denominator)
        if isinstance(value, tuple) and len(value) == 2:
            num, den = value
            if den == 0:
                return None
            return float(num) / float(den)
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _format_shutter_speed(exposure_time) -> str | None:
    seconds = _rational_to_float(exposure_time)
    if seconds is None or seconds <= 0:
        return None
    if seconds >= 1:
        text = f"{seconds:g}"
        return text if text.endswith("s") else f"{text}s"
    denom = max(1, round(1 / seconds))
    return f"1/{denom}"


def _exif_str(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        try:
            text = value.decode("utf-8", errors="ignore")
        except Exception:
            return None
    else:
        text = str(value)
    text = text.strip().strip("\x00")
    return text or None


def _combine_camera_make_model(make: str | None, model: str | None) -> str | None:
    if not make and not model:
        return None
    if make and not model:
        return make
    if model and not make:
        return model
    if model.lower().startswith(make.lower()):
        return model
    return f"{make} {model}"


def _parse_exif_datetime_original(raw: str | None) -> datetime | None:
    if not raw or not isinstance(raw, str):
        return None
    text = raw.strip()
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _extract_photo_exif(image_bytes: bytes) -> dict:
    """Lees EXIF vóór WebP-conversie (originele metadata)."""
    defaults = {
        "iso": None,
        "aperture": None,
        "focal_length": None,
        "shutter_speed": None,
        "camera_model": None,
        "timestamp": datetime.now(),
    }
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif = img.getexif()
        if not exif:
            return defaults

        exif_ifd = exif.get_ifd(0x8769) if hasattr(exif, "get_ifd") else {}
        merged: dict = {}
        for source in (exif, exif_ifd):
            if not source:
                continue
            for tag_id, value in source.items():
                merged[tag_id] = value

        iso = merged.get(_EXIF_TAG_NAME_TO_ID.get("ISOSpeedRatings", 34855))
        if iso is None:
            iso = merged.get(_EXIF_TAG_NAME_TO_ID.get("PhotographicSensitivity", 34864))
        if isinstance(iso, (list, tuple)) and iso:
            iso = iso[0]

        aperture = _rational_to_float(merged.get(_EXIF_TAG_NAME_TO_ID.get("FNumber", 33437)))
        focal_length = _rational_to_float(merged.get(_EXIF_TAG_NAME_TO_ID.get("FocalLength", 37386)))
        shutter_speed = _format_shutter_speed(merged.get(_EXIF_TAG_NAME_TO_ID.get("ExposureTime", 33434)))

        make = _exif_str(merged.get(_EXIF_TAG_NAME_TO_ID.get("Make", 271)))
        model = _exif_str(merged.get(_EXIF_TAG_NAME_TO_ID.get("Model", 272)))
        camera_model = _combine_camera_make_model(make, model)

        dt_original = merged.get(_EXIF_TAG_NAME_TO_ID.get("DateTimeOriginal", 36867))
        if dt_original is None:
            dt_original = merged.get(_EXIF_TAG_NAME_TO_ID.get("DateTime", 306))
        capture_time = _parse_exif_datetime_original(dt_original if isinstance(dt_original, str) else None)
        if capture_time is None:
            capture_time = datetime.now()

        iso_value = None
        if iso is not None:
            try:
                iso_value = int(iso)
            except (TypeError, ValueError):
                iso_value = None

        return {
            "iso": iso_value,
            "aperture": aperture,
            "focal_length": focal_length,
            "shutter_speed": shutter_speed,
            "camera_model": camera_model,
            "timestamp": capture_time,
        }
    except Exception:
        return defaults


def _compress_image(image_bytes: bytes, filename_base: str) -> tuple[str, str, str, str]:
    """Compress image to WebP and generate square thumbnail.

    Returns:
        (main_fs_path, thumb_fs_path, main_url, thumb_url)
    """
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
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


def _latest_observation(observations: list[Observation]) -> Observation | None:
    if not observations:
        return None
    return max(observations, key=lambda o: o.timestamp)


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
        "iso": obs.iso,
        "aperture": obs.aperture,
        "focal_length": obs.focal_length,
        "shutter_speed": obs.shutter_speed,
        "camera_model": obs.camera_model,
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
    animals = session.exec(
        select(Animal).options(selectinload(Animal.observations))
    ).all()
    result = []
    for animal in animals:
        latest_obs = _latest_observation(list(animal.observations))
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
    animal = session.exec(
        select(Animal)
        .where(Animal.id == animal_id)
        .options(selectinload(Animal.observations))
    ).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    all_obs = sorted(animal.observations, key=lambda o: o.timestamp, reverse=True)
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
    # Bestand lezen
    image_bytes = await file.read()

    # Stap 1: Valideer dat het daadwerkelijk een afbeelding is (voor verwerking)
    _validate_image(image_bytes)

    photo_exif = _extract_photo_exif(image_bytes)

    # Stap 2: Sla op met veilige, UUID-gebaseerde bestandsnaam (geen gebruikersinput)
    safe_base = _safe_filename_base(file.filename)
    filename_base = os.path.splitext(safe_base)[0]
    try:
        main_fs, thumb_fs, image_url, thumbnail_url = _compress_image(image_bytes, filename_base)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="Afbeelding kon niet worden verwerkt.")
    commit_uploads_if_configured()
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
        ai_result = mock_identify_animal(image_url)
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
        is_wild=is_wild,
        timestamp=photo_exif["timestamp"],
        iso=photo_exif["iso"],
        aperture=photo_exif["aperture"],
        focal_length=photo_exif["focal_length"],
        shutter_speed=photo_exif["shutter_speed"],
        camera_model=photo_exif["camera_model"],
    )
    
    # Compute unlocked badges BEFORE saving the new observation
    before_ids = badge_service.evaluate_unlocked_badge_ids(session)

    session.add(observation)
    session.commit()
    session.refresh(observation)

    # Compute unlocked badges AFTER saving and detect newly unlocked
    after_ids = badge_service.evaluate_unlocked_badge_ids(session)
    new_ids = after_ids - before_ids
    newly_unlocked = badge_service.record_new_unlocks(session, new_ids)

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
        "newly_unlocked_badges": newly_unlocked,
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
    commit_uploads_if_configured()

    session.delete(obs)
    session.commit()

    return {"ok": True, "deleted_id": observation_id}


@app.get("/api/badges")
def get_badges(session: Session = Depends(get_session)):
    return badge_service.get_badges_with_progress(session)


@app.get("/api/stats")
def get_stats(session: Session = Depends(get_session)):
    return badge_service.get_stats(session)


_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isfile(os.path.join(_STATIC_DIR, "index.html")):
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="frontend")
