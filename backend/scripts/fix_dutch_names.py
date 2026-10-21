"""
fix_dutch_names.py — Corrigeer foutieve Nederlandse soortnamen in species JSON-bestanden.

Gebruikt iNaturalist (locale=nl) als primaire bron en Wikidata (P225) als fallback,
maar alleen als het NL-label geen wetenschappelijke naam is. Vervangt alleen namen
die duidelijk fout zijn (binomiale vorm, gelijk aan scientific_name, of geen overlap
met de officiële volksnaam).

Gebruik:
    python backend/scripts/fix_dutch_names.py
    python backend/scripts/fix_dutch_names.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from typing import Any

os.environ.pop("SSLKEYLOGFILE", None)
import requests

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
BENELUX_PATH = os.path.join(DATA_DIR, "species_benelux.json")
ZOO_PATH = os.path.join(DATA_DIR, "species_zoo.json")
INAT_CACHE_PATH = os.path.join(DATA_DIR, "inat_nl_names_cache.json")

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
INAT_API = "https://api.inaturalist.org/v1/taxa"
BATCH_SIZE = 40
SLEEP_S = 1.1
HEADERS = {"User-Agent": "BioLoggr/1.0 (dutch-name-fixer)"}


def load_inat_cache() -> dict[str, str | None]:
    if not os.path.exists(INAT_CACHE_PATH):
        return {}
    with open(INAT_CACHE_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {k: (v if v else None) for k, v in raw.items()}


def save_inat_cache(cache: dict[str, str | None]) -> None:
    with open(INAT_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _escape_sparql_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def is_binomial(name: str) -> bool:
    """True als de string op een wetenschelijke soortnaam lijkt."""
    return bool(re.match(r"^[A-Z][a-z]+ [a-z]+(-[a-z]+)?$", name.strip()))


def fetch_wikidata_nl_names(scientific_names: list[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for i in range(0, len(scientific_names), BATCH_SIZE):
        batch = scientific_names[i : i + BATCH_SIZE]
        values = " ".join(f'"{_escape_sparql_string(n)}"' for n in batch)
        query = f"""
SELECT ?scientificName ?dutchLabel WHERE {{
  VALUES ?scientificName {{ {values} }}
  ?item wdt:P225 ?scientificName .
  ?item rdfs:label ?dutchLabel .
  FILTER(LANG(?dutchLabel) = "nl")
}}
"""
        time.sleep(1.0)
        resp = requests.get(
            WIKIDATA_SPARQL,
            params={"query": query, "format": "json"},
            headers=HEADERS,
            timeout=60,
        )
        resp.raise_for_status()
        for binding in resp.json().get("results", {}).get("bindings", []):
            sci = binding.get("scientificName", {}).get("value", "").strip()
            label = binding.get("dutchLabel", {}).get("value", "").strip()
            if sci and label and not is_binomial(label) and sci not in found:
                found[sci] = label
    return found


def fetch_inat_nl_name(scientific_name: str) -> str | None:
    for attempt in range(6):
        time.sleep(SLEEP_S)
        resp = requests.get(
            INAT_API,
            params={
                "q": scientific_name,
                "rank": "species",
                "locale": "nl",
                "per_page": 10,
            },
            headers=HEADERS,
            timeout=25,
        )
        if resp.status_code == 429:
            time.sleep(15 * (attempt + 1))
            continue
        resp.raise_for_status()
        for taxon in resp.json().get("results", []):
            if (taxon.get("name") or "").strip() == scientific_name:
                name = (taxon.get("preferred_common_name") or "").strip()
                if name and not is_binomial(name):
                    return name
        return None
    return None


def resolve_official_name(
    scientific_name: str,
    wikidata: dict[str, str],
    cache_inat: dict[str, str | None],
) -> str | None:
    wd = wikidata.get(scientific_name)
    if wd:
        return wd
    if scientific_name not in cache_inat:
        cache_inat[scientific_name] = fetch_inat_nl_name(scientific_name)
    return cache_inat[scientific_name]


def names_are_related(current: str, official: str) -> bool:
    a = current.strip().lower()
    b = official.strip().lower()
    if not a or not b or a == b:
        return True
    if a in b or b in a:
        return True
    return bool(set(a.split()) & set(b.split()))


def should_replace(current: str, official: str, scientific_name: str) -> bool:
    current = current.strip()
    official = official.strip()
    if not official or names_are_related(current, official):
        return False
    if is_binomial(current) or current.lower() == scientific_name.lower():
        return True
    return True


def needs_inat_lookup(
    current: str,
    scientific_name: str,
    wikidata: dict[str, str],
    verify_all: bool,
) -> bool:
    if verify_all:
        return True
    if not (is_binomial(current) or current.lower() == scientific_name.lower()):
        return False
    return scientific_name not in wikidata


def fix_file(
    path: str,
    wikidata: dict[str, str],
    cache_inat: dict[str, str | None],
    dry_run: bool,
    verify_all: bool,
) -> tuple[int, int]:
    if not os.path.exists(path):
        print(f"  [warn] Bestand niet gevonden: {path}")
        return 0, 0

    with open(path, encoding="utf-8") as f:
        species_list: list[dict[str, Any]] = json.load(f)

    changed = 0
    checked = 0
    for sp in species_list:
        sci = (sp.get("scientific_name") or "").strip()
        if not sci:
            continue
        checked += 1
        current = (sp.get("dutch_name") or "").strip()
        if not needs_inat_lookup(current, sci, wikidata, verify_all):
            continue
        official = resolve_official_name(sci, wikidata, cache_inat)
        if not official or not should_replace(current, official, sci):
            continue
        print(f"  {sci}: '{current}' -> '{official}'")
        if not dry_run:
            sp["dutch_name"] = official
        changed += 1

    if changed and not dry_run:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(species_list, f, ensure_ascii=False, indent=2)
            f.write("\n")

    save_inat_cache(cache_inat)
    return checked, changed


def _load_species(path: str) -> list[dict[str, Any]]:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _species_needing_lookup(
    species_list: list[dict[str, Any]],
    verify_all: bool,
) -> set[str]:
    names: set[str] = set()
    for sp in species_list:
        sci = (sp.get("scientific_name") or "").strip()
        if not sci:
            continue
        current = (sp.get("dutch_name") or "").strip()
        if verify_all or is_binomial(current) or current.lower() == sci.lower():
            names.add(sci)
    return names


def main() -> None:
    parser = argparse.ArgumentParser(description="Corrigeer foutieve Nederlandse soortnamen in species JSON.")
    parser.add_argument("--dry-run", action="store_true", help="Toon wijzigingen zonder bestanden te schrijven")
    args = parser.parse_args()

    file_jobs = [
        (BENELUX_PATH, False),
        (ZOO_PATH, True),
    ]
    lookup_sci: set[str] = set()
    for path, verify_all in file_jobs:
        lookup_sci |= _species_needing_lookup(_load_species(path), verify_all)

    scientific_names = sorted(lookup_sci)
    print(f"[info] {len(scientific_names)} soorten voor externe controle - Wikidata ophalen...", flush=True)
    wikidata = fetch_wikidata_nl_names(scientific_names)
    print(f"       Wikidata: {len(wikidata)} bruikbare NL-labels (geen binomiaal)", flush=True)

    cache_inat: dict[str, str | None] = load_inat_cache()
    total_checked = total_changed = 0
    for path, verify_all in file_jobs:
        label = os.path.basename(path)
        print(f"\n[file] {label}", flush=True)
        checked, changed = fix_file(path, wikidata, cache_inat, args.dry_run, verify_all)
        total_checked += checked
        total_changed += changed
        print(f"   Gecontroleerd: {checked}, gewijzigd: {changed}", flush=True)

    mode = "(dry-run)" if args.dry_run else ""
    print(f"\n[done] Klaar {mode}: {total_changed} naamswijzigingen op {total_checked} soorten.", flush=True)
    if args.dry_run and total_changed:
        print("   Draai zonder --dry-run om JSON bij te werken, daarna: python backend/seed.py")


if __name__ == "__main__":
    main()
