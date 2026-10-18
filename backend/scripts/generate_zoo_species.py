"""
generate_zoo_species.py — Genereer ~500 dierentuin-/exotensoorten voor BioLoggr

Haalt wereldwijd veel waargenomen soorten op via iNaturalist (zonder plaatsfilter),
slaat Benelux-inheemse soorten over en schrijft:
    backend/data/species_zoo.json

Gebruik:
    python backend/scripts/generate_zoo_species.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

os.environ.pop("SSLKEYLOGFILE", None)

import requests

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
BENELUX_PATH = DATA_DIR / "species_benelux.json"
OUTPUT_PATH = DATA_DIR / "species_zoo.json"

INAT_API = "https://api.inaturalist.org/v1"
PER_PAGE = 200
SLEEP_S = 0.6
TARGET = 500

# (label, category_nl, taxon_id, template_key, max_species)
GROUPS: list[tuple[str, str, int, str, int]] = [
    ("Zoogdieren", "Zoogdieren", 40151, "Mammalia", 220),
    ("Vogels", "Vogels", 3, "Aves", 170),
    ("Reptielen", "Reptielen & Amfibieën", 26036, "Reptilia", 55),
    ("Amfibieën", "Reptielen & Amfibieën", 20978, "Amphibia", 45),
    ("Vissen", "Vissen", 47178, "Actinopterygii", 70),
    ("Insecten", "Insecten", 47158, "Insecta", 40),
    ("Ongewervelden", "Ongewervelden", 47115, "Invertebrata", 50),
]

HABITAT: dict[str, str] = {
    "Mammalia": "Savannes, tropische bossen, bergen en semi-aride gebieden (vaak nagebootst in dierentuinen)",
    "Aves": "Uiteenlopende biotopen wereldwijd; veel soorten in volières en vogelparken",
    "Reptilia": "Warme, droge of vochtige tropische en subtropische habitats",
    "Amphibia": "Tropische regenwouden, moerassen en stilstaand water",
    "Actinopterygii": "Zoet- en zoutwater; aquaria en grote bassins in dierentuinen",
    "Insecta": "Tropische en subtropische leefgebieden; insectenhuizen en vlindertuinen",
    "Invertebrata": "Oceanen, koraalriffen en tropische kustwateren",
}

DIET: dict[str, str] = {
    "Mammalia": "Gevarieerd per soort (herbivoor, carnivoor of omnivoor)",
    "Aves": "Zaden, fruit, insecten, vis of kleine prooi afhankelijk van soort",
    "Reptilia": "Insecten, kleine gewervelden of plantaardig materiaal",
    "Amphibia": "Insecten en andere kleine ongewervelden",
    "Actinopterygii": "Algen, plankton, ongewervelden of kleinere vissen",
    "Insecta": "Nectar, bladeren, fruit of andere insecten",
    "Invertebrata": "Plankton, schaaldieren, algen of aas",
}

DESC = "Een exotische diersoort die veel voorkomt in Europese dierentuinen, aquaria of volières."

IUCN: dict[str, str] = {
    "LC": "Niet bedreigd (LC)",
    "NT": "Bijna bedreigd (NT)",
    "VU": "Kwetsbaar (VU)",
    "EN": "Bedreigd (EN)",
    "CR": "Ernstig bedreigd (CR)",
}


def inat_get(endpoint: str, params: dict) -> dict:
    url = f"{INAT_API}/{endpoint}"
    resp = requests.get(url, params=params, headers={"User-Agent": "BioLoggr/1.0"}, timeout=25)
    resp.raise_for_status()
    return resp.json()


def load_benelux_scientific_names() -> set[str]:
    if not BENELUX_PATH.exists():
        return set()
    with open(BENELUX_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return {sp["scientific_name"].strip() for sp in data if sp.get("scientific_name")}


def determine_rarity(count: int) -> str:
    if count >= 50_000:
        return "Algemeen"
    if count >= 8_000:
        return "Vrij algemeen"
    if count >= 800:
        return "Zeldzaam"
    return "Bedreigd"


def clean_wiki(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:280].rstrip() + ("…" if len(text) > 280 else "")


def build_extra_info(taxon: dict, key: str) -> dict:
    cs = taxon.get("conservation_status") or {}
    iucn_code = (cs.get("status_name") or "").upper()
    return {
        "habitat": HABITAT.get(key, "Diverse tropische en subtropische biotopen"),
        "diet": DIET.get(key, "Gevarieerd"),
        "status_bedreiging": IUCN.get(iucn_code, "Niet bedreigd (LC)"),
    }


def fetch_global_group(
    taxon_id: int,
    template_key: str,
    max_n: int,
    skip_names: set[str],
) -> list[dict[str, Any]]:
    results_map: dict[str, dict] = {}
    page = 1

    while len(results_map) < max_n * 2:
        time.sleep(SLEEP_S)
        data = inat_get(
            "observations/species_counts",
            {
                "taxon_id": taxon_id,
                "quality_grade": "research",
                "locale": "nl",
                "per_page": PER_PAGE,
                "page": page,
            },
        )
        batch = data.get("results", [])
        if not batch:
            break
        for item in batch:
            taxon = item.get("taxon", {})
            sci_name = (taxon.get("name") or "").strip()
            if not sci_name or sci_name in skip_names:
                continue
            if taxon.get("rank") not in ("species", None):
                continue
            count = item.get("count", 0)
            if sci_name not in results_map or count > results_map[sci_name]["count"]:
                results_map[sci_name] = {"count": count, "taxon": taxon}
        total_api = data.get("total_results", 0)
        if page * PER_PAGE >= total_api:
            break
        page += 1

    sorted_items = sorted(results_map.items(), key=lambda x: -x[1]["count"])[:max_n]
    species: list[dict[str, Any]] = []
    for sci_name, info in sorted_items:
        taxon = info["taxon"]
        nl_name = (taxon.get("preferred_common_name") or "").strip()
        if not nl_name:
            continue
        wiki = (taxon.get("wikipedia_summary") or "").strip()
        description = clean_wiki(wiki) if wiki else DESC
        species.append(
            {
                "dutch_name": nl_name.capitalize(),
                "scientific_name": sci_name,
                "category": "",  # filled by caller
                "rarity": determine_rarity(info["count"]),
                "description": description,
                "image_url": None,
                "is_native": False,
                "extra_info": build_extra_info(taxon, template_key),
            }
        )
    return species


def main() -> None:
    skip = load_benelux_scientific_names()
    all_species: list[dict[str, Any]] = []
    seen: set[str] = set()

    for label, category_nl, taxon_id, tmpl_key, max_n in GROUPS:
        print(f">> {label} (taxon_id={taxon_id}, max {max_n})…")
        group = fetch_global_group(taxon_id, tmpl_key, max_n, skip | seen)
        for sp in group:
            sp["category"] = category_nl
            sci = sp["scientific_name"]
            if sci in seen:
                continue
            seen.add(sci)
            all_species.append(sp)
        print(f"   => {len(group)} kandidaten, totaal uniek: {len(all_species)}")

    if len(all_species) < TARGET:
        print(f"Waarschuwing: slechts {len(all_species)} soorten (doel ~{TARGET}).")

    all_species.sort(key=lambda s: (s["category"], s["dutch_name"].lower()))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_species, f, ensure_ascii=False, indent=2)

    by_cat: dict[str, int] = {}
    for s in all_species:
        by_cat[s["category"]] = by_cat.get(s["category"], 0) + 1
    print("\nPer categorie:")
    for cat, n in sorted(by_cat.items()):
        print(f"  {cat}: {n}")
    print(f"\nKLAAR: {len(all_species)} soorten -> {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Fout bij genereren: {exc}", file=sys.stderr)
        sys.exit(1)
