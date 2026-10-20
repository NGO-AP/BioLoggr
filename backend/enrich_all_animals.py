"""
enrich_all_animals.py — Verrijk alle dierbeschrijvingen via de Nederlandstalige Wikipedia API.

Gebruik (vanuit projectroot):
    python backend/enrich_all_animals.py
"""

import os
import re
import sys
import time

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlmodel import Session, select

from backend.database import engine
from backend.models import Animal

WIKI_API_URL = "https://nl.wikipedia.org/w/api.php"
BATCH_COMMIT_SIZE = 50
MAX_DESCRIPTION_CHARS = 400
MAX_SENTENCES = 3
SLEEP_SECONDS = 0.2


def truncate_for_ui(text: str) -> str:
    text = text.strip()
    if not text:
        return text

    sentences = re.split(r"(?<=[.!?])\s+", text)
    if len(sentences) > 1:
        by_sentences = " ".join(sentences[:MAX_SENTENCES]).strip()
        if len(by_sentences) <= MAX_DESCRIPTION_CHARS:
            return by_sentences

    if len(text) <= MAX_DESCRIPTION_CHARS:
        return text

    chunk = text[:MAX_DESCRIPTION_CHARS]
    last_period = chunk.rfind(".")
    if last_period > 0:
        return chunk[: last_period + 1].strip()
    return chunk.strip()


def fetch_wikipedia_extract(title: str) -> str | None:
    params = {
        "action": "query",
        "format": "json",
        "prop": "extracts",
        "exintro": "true",
        "explaintext": "true",
        "redirects": "1",
        "titles": title,
    }
    headers = {
        "User-Agent": "BioLoggrApp/1.0 (contact: admin@biologgr.local) python-requests"
    }
    response = requests.get(WIKI_API_URL, params=params, headers=headers, timeout=30)
    response.raise_for_status()
    data = response.json()

    pages = data.get("query", {}).get("pages", {})
    for page_id, page in pages.items():
        if str(page_id) == "-1":
            return None
        extract = (page.get("extract") or "").strip()
        if extract:
            return extract
    return None


def main() -> None:
    with Session(engine) as session:
        animals = session.exec(select(Animal)).all()

        print(f"Te verrijken: {len(animals)} dieren")

        updated_since_commit = 0
        for animal in animals:
            try:
                extract = fetch_wikipedia_extract(animal.dutch_name)
                if not extract:
                    extract = fetch_wikipedia_extract(animal.scientific_name)
            except Exception as e:
                print(f"⚠️ API-fout voor {animal.dutch_name}: {e}")
                time.sleep(SLEEP_SECONDS)
                continue

            if not extract:
                print(f"❌ Niet gevonden: {animal.dutch_name}")
                time.sleep(SLEEP_SECONDS)
                continue

            animal.description = truncate_for_ui(extract)
            session.add(animal)
            updated_since_commit += 1
            print(f"✅ Bijgewerkt: {animal.dutch_name}")

            if updated_since_commit >= BATCH_COMMIT_SIZE:
                session.commit()
                updated_since_commit = 0

            time.sleep(SLEEP_SECONDS)

        if updated_since_commit:
            session.commit()

        print("Klaar.")


if __name__ == "__main__":
    main()
