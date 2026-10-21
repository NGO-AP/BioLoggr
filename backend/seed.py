"""
seed.py — Lokale database-seeder voor BioLoggr

Leest 'backend/data/species_benelux.json' en 'backend/data/species_zoo.json' in
en doet een upsert in SQLite: nieuwe soorten worden toegevoegd, Benelux-soorten
worden bijgewerkt. Zoodieren die al als Benelux-soort bestaan worden overgeslagen
(zodat rijkere Benelux-metadata behouden blijft). Bestaande Observation-records
worden NOOIT verwijderd.

Gebruik:
    python backend/seed.py
"""

import json
import os
import sys

# Zorg dat de backend-package vindbaar is vanuit projectroot
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlmodel import Session, select
from backend.database import engine, init_db
from backend.models import Animal, Badge

BENELUX_JSON_PATH = os.path.join(os.path.dirname(__file__), "data", "species_benelux.json")
ZOO_JSON_PATH = os.path.join(os.path.dirname(__file__), "data", "species_zoo.json")

ZOO_DEFAULT_DESCRIPTION = (
    "Een exotische diersoort die veel voorkomt in Europese dierentuinen, aquaria of volières."
)

DEFAULT_BADGES: list[dict] = [
    {
        "name": "Eerste Waarneming",
        "description": "Registreer je allereerste dier in de codex.",
        "icon": "🏆",
        "unlocked_at": None,
    },
    {
        "name": "Nachtvlinder",
        "description": "Vind een zeldzame of bedreigde soort.",
        "icon": "🌙",
        "unlocked_at": None,
    },
    {
        "name": "Boswachter",
        "description": "Ontdek minstens 5 verschillende soorten.",
        "icon": "🌲",
        "unlocked_at": None,
    },
]


def _normalize_species(sp: dict, *, from_zoo: bool) -> dict:
    """Map JSON-records naar Animal-velden."""
    if from_zoo:
        return {
            "scientific_name": sp["scientific_name"],
            "dutch_name": sp["dutch_name"],
            "category": sp.get("category") or sp.get("taxonomy_group") or "Zoogdieren",
            "rarity": sp.get("rarity") or "Algemeen",
            "description": sp.get("description") or ZOO_DEFAULT_DESCRIPTION,
            "image_url": sp.get("image_url"),
            "extra_info": sp.get("extra_info"),
        }
    return {
        "scientific_name": sp["scientific_name"],
        "dutch_name": sp["dutch_name"],
        "category": sp["category"],
        "rarity": sp["rarity"],
        "description": sp["description"],
        "image_url": sp.get("image_url"),
        "extra_info": sp.get("extra_info"),
    }


def _upsert_species_list(
    session: Session,
    species_list: list[dict],
    *,
    from_zoo: bool,
    update_existing: bool,
) -> tuple[int, int, int]:
    """
    Upsert soorten uit een JSON-lijst.
    Retourneert (nieuw_toegevoegd, bijgewerkt, overgeslagen).
    """
    added = 0
    updated = 0
    skipped = 0

    for raw in species_list:
        sp = _normalize_species(raw, from_zoo=from_zoo)
        sci_name = sp["scientific_name"]
        existing = session.exec(
            select(Animal).where(Animal.scientific_name == sci_name)
        ).first()

        if existing:
            if not update_existing:
                skipped += 1
                continue
            existing.dutch_name = sp["dutch_name"]
            existing.category = sp["category"]
            existing.rarity = sp["rarity"]
            existing.description = sp["description"]
            existing.extra_info = sp.get("extra_info")
            existing.image_url = None
            session.add(existing)
            updated += 1
        else:
            animal = Animal(
                scientific_name=sci_name,
                dutch_name=sp["dutch_name"],
                category=sp["category"],
                rarity=sp["rarity"],
                description=sp["description"],
                image_url=sp.get("image_url"),
                extra_info=sp.get("extra_info"),
            )
            session.add(animal)
            added += 1

    session.commit()
    return added, updated, skipped


def _load_json_list(path: str) -> list[dict]:
    if not os.path.exists(path):
        print(f"❌ JSON-bestand niet gevonden: {path}")
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def seed_benelux_species(session: Session) -> tuple[int, int, int]:
    """Upsert alle soorten uit species_benelux.json."""
    species_list = _load_json_list(BENELUX_JSON_PATH)
    if not species_list:
        print("   Voer eerst 'python backend/scripts/fetch_species.py' uit voor Benelux.")
        return 0, 0, 0
    return _upsert_species_list(
        session, species_list, from_zoo=False, update_existing=True
    )


def seed_zoo_species(session: Session) -> tuple[int, int, int]:
    """Voeg zoodieren toe uit species_zoo.json (bestaande Benelux-soorten blijven ongewijzigd)."""
    species_list = _load_json_list(ZOO_JSON_PATH)
    if not species_list:
        return 0, 0, 0
    return _upsert_species_list(
        session, species_list, from_zoo=True, update_existing=False
    )


def seed_species(session: Session) -> tuple[int, int]:
    """Seed Benelux- en zoolijst (gebruikt door FastAPI-startup)."""
    ben_added, ben_updated, _ = seed_benelux_species(session)
    zoo_added, _, _ = seed_zoo_species(session)
    return ben_added + zoo_added, ben_updated


def seed_badges(session: Session) -> None:
    """Voegt ontbrekende badges toe (geen duplicaten)."""
    existing_names = set(session.exec(select(Badge.name)).all())
    for spec in DEFAULT_BADGES:
        if spec["name"] not in existing_names:
            session.add(Badge(**spec))
    session.commit()


def run_seed() -> None:
    """Hoofdfunctie: initialiseer DB en seed alles."""
    init_db()
    with Session(engine) as session:
        ben_added, ben_updated, _ = seed_benelux_species(session)
        zoo_added, zoo_updated, zoo_skipped = seed_zoo_species(session)
        seed_badges(session)

    total_added = ben_added + zoo_added
    total_updated = ben_updated + zoo_updated
    if total_added or total_updated or zoo_skipped:
        print(
            f"✅ Seeding voltooid: {total_added} nieuw "
            f"({ben_added} Benelux, {zoo_added} zoo), "
            f"{total_updated} bijgewerkt (Benelux), "
            f"{zoo_skipped} zoo overgeslagen (al in DB)."
        )
    else:
        print("ℹ️  Geen soorten geseed (JSON-bestanden ontbreken?).")


if __name__ == "__main__":
    run_seed()
