"""
seed.py — Lokale database-seeder voor BioLoggr

Leest 'backend/data/species_benelux.json' in en doet een schone upsert
in SQLite: nieuwe soorten worden toegevoegd, bestaande soorten worden
bijgewerkt. Bestaande Observation-records worden NOOIT verwijderd.

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

JSON_PATH = os.path.join(os.path.dirname(__file__), "data", "species_benelux.json")

DEFAULT_BADGES = [
    Badge(
        name="Eerste Waarneming",
        description="Registreer je allereerste dier in de codex.",
        icon="🏆",
        unlocked_at=None,
    ),
    Badge(
        name="Nachtvlinder",
        description="Vind een zeldzame of bedreigde soort.",
        icon="🌙",
        unlocked_at=None,
    ),
    Badge(
        name="Boswachter",
        description="Ontdek minstens 5 verschillende soorten.",
        icon="🌲",
        unlocked_at=None,
    ),
]


def seed_species(session: Session) -> tuple[int, int]:
    """
    Upsert alle soorten uit species_benelux.json.
    Retourneert (nieuw_toegevoegd, bijgewerkt).
    """
    if not os.path.exists(JSON_PATH):
        print(f"❌ JSON-bestand niet gevonden: {JSON_PATH}")
        print("   Voer eerst 'python backend/scripts/fetch_species.py' uit.")
        return 0, 0

    with open(JSON_PATH, encoding="utf-8") as f:
        species_list: list[dict] = json.load(f)

    added = 0
    updated = 0

    for sp in species_list:
        sci_name = sp["scientific_name"]
        existing = session.exec(
            select(Animal).where(Animal.scientific_name == sci_name)
        ).first()

        if existing:
            # Bijwerken — behoud ID zodat Observation-foreign-keys intact blijven
            existing.dutch_name  = sp["dutch_name"]
            existing.category    = sp["category"]
            existing.rarity      = sp["rarity"]
            existing.description = sp["description"]
            existing.extra_info  = sp.get("extra_info")
            # image_url altijd resetten: de observatiefoto (latest_observation.image_path)
            # heeft voorrang; de vaste upload-paden van de oude seed bestaan niet meer.
            existing.image_url = None
            session.add(existing)
            updated += 1
        else:
            animal = Animal(
                scientific_name = sci_name,
                dutch_name       = sp["dutch_name"],
                category         = sp["category"],
                rarity           = sp["rarity"],
                description      = sp["description"],
                image_url        = sp.get("image_url"),   # None voor iNat-soorten
                extra_info       = sp.get("extra_info"),
            )
            session.add(animal)
            added += 1

    session.commit()
    return added, updated


def seed_badges(session: Session) -> None:
    """Voegt ontbrekende badges toe (geen duplicaten)."""
    existing_names = {b.name for b in session.exec(select(Badge)).all()}
    for badge in DEFAULT_BADGES:
        if badge.name not in existing_names:
            session.add(badge)
    session.commit()


def run_seed() -> None:
    """Hoofdfunctie: initialiseer DB en seed alles."""
    init_db()
    with Session(engine) as session:
        added, updated = seed_species(session)
        seed_badges(session)

    if added or updated:
        print(f"✅ Seeding voltooid: {added} nieuw, {updated} bijgewerkt.")
    else:
        print("ℹ️  Geen soorten geseed (JSON-bestand ontbreekt?).")


if __name__ == "__main__":
    run_seed()
