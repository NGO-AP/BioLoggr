"""
fetch_species.py — Complete Benelux species-fetcher voor BioLoggr

Haalt via de publieke iNaturalist API een realistische soortenlijst op
voor België (place_id=7008) EN Nederland (place_id=7506), gecombineerd
per taxonomische groep. Resultaat wordt weggeschreven naar:
    backend/data/species_benelux.json

Gebruik:
    python backend/scripts/fetch_species.py
"""

import json
import os
import re
import time
from typing import Any

os.environ.pop("SSLKEYLOGFILE", None)
import requests

# ── Configuratie ──────────────────────────────────────────────────────────────

INAT_API    = "https://api.inaturalist.org/v1"
PLACE_IDS   = [7008, 7506]   # België, Nederland
PER_PAGE    = 200            # max per iNaturalist-call
SLEEP_S     = 0.8            # pauze tussen API-calls (rate-limit: 100 req/min)

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "species_benelux.json")

# Groepen: (label, category_nl, taxon_id, template_key, max_species)
# max_species=None → haal ALLE soorten op (pagineren)
GROUPS: list[tuple[str, str, int, str, int | None]] = [
    ("Amfibieën",        "Reptielen & Amfibieën", 20978, "Amphibia",  None),
    ("Reptielen",        "Reptielen & Amfibieën", 26036, "Reptilia",  None),
    ("Zoogdieren",       "Zoogdieren",            40151, "Mammalia",  None),
    ("Vogels",           "Vogels",                3,     "Aves",      350),
    ("Dagvlinders",      "Insecten",              47224, "Insecta",   None),
    ("Libellen",         "Insecten",              47792, "Insecta",   None),
    ("Kevers",           "Insecten",              47158, "Insecta",   75),
    ("Bijen & Hommels",  "Insecten",              47201, "Insecta",   75),
]

# ── Sjablonen per groep ───────────────────────────────────────────────────────

HABITAT: dict[str, str] = {
    "Mammalia": "Bossen, struikgewas, landbouwgrond en stedelijk groen",
    "Aves":     "Gevarieerde biotopen: bossen, velden, moerassen en tuinen",
    "Insecta":  "Bloemrijke graslanden, bosranden, wateroevers en heidevelden",
    "Reptilia": "Zonnige, beschutte plaatsen: heideterreinen, bosranden en stenige hellingen",
    "Amphibia": "Vochtige biotopen: poelen, moerassen, sloten en aangrenzende landterreinen",
}

DIET: dict[str, str] = {
    "Mammalia": "Gevarieerd — afhankelijk van soort (insectivoor, herbivoor of omnivoor)",
    "Aves":     "Insecten, zaden, bessen of kleine gewervelden afhankelijk van soort",
    "Insecta":  "Nectar, plantensap, schimmels of andere ongewervelden",
    "Reptilia": "Insecten, wormen, slakken en kleine ongewervelden",
    "Amphibia": "Insecten, wormen, slakjes en kleine waterorganismen",
}

DESC: dict[str, str] = {
    "Mammalia": "Een in de Benelux voorkomende zoogdiersoort met een kenmerkend gedrag en leefgebied.",
    "Aves":     "Een in de Benelux waargenomen vogelsoort met herkenbaar uiterlijk en zang.",
    "Insecta":  "Een inheems insect dat een essentiële rol speelt in de Benelux-ecosystemen.",
    "Reptilia": "Een Benelux-reptielsoort die afhankelijk is van warmte en zonnige biotopen.",
    "Amphibia": "Een Benelux-amfibieënsoort, sterk gebonden aan schoon, stilstaand water.",
}

IUCN: dict[str, str] = {
    "LC": "Niet bedreigd (LC)",
    "NT": "Bijna bedreigd (NT)",
    "VU": "Kwetsbaar (VU)",
    "EN": "Bedreigd (EN)",
    "CR": "Ernstig bedreigd (CR)",
    "EW": "Uitgestorven in het wild (EW)",
    "EX": "Uitgestorven (EX)",
}

# ── Hulpfuncties ──────────────────────────────────────────────────────────────

def inat_get(endpoint: str, params: dict) -> dict:
    url = f"{INAT_API}/{endpoint}"
    resp = requests.get(url, params=params, headers={"User-Agent": "BioLoggr/1.0"}, timeout=20)
    resp.raise_for_status()
    return resp.json()


def determine_rarity(count: int) -> str:
    """Zeldzaamheid op basis van gecombineerd Benelux-observatieaantal."""
    if count >= 10_000:
        return "Algemeen"
    elif count >= 1_500:
        return "Vrij algemeen"
    elif count >= 150:
        return "Zeldzaam"
    else:
        return "Bedreigd"


def clean_wiki(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:280].rstrip() + ("…" if len(text) > 280 else "")


def build_extra_info(taxon: dict, key: str) -> dict:
    cs = taxon.get("conservation_status") or {}
    iucn_code = (cs.get("status_name") or "").upper()
    return {
        "habitat": HABITAT.get(key, "Diverse biotopen"),
        "diet":    DIET.get(key, "Gevarieerd"),
        "status_bedreiging": IUCN.get(iucn_code, "Niet bedreigd (LC)"),
    }


def fetch_one_place(taxon_id: int, place_id: int, max_n: int | None) -> dict[str, dict]:
    """
    Haalt alle (of top max_n) soorten op voor één place_id via paginering.
    Retourneert dict: scientific_name -> {"count": int, "taxon": dict}
    """
    results_map: dict[str, dict] = {}
    page = 1

    while True:
        time.sleep(SLEEP_S)
        data = inat_get("observations/species_counts", {
            "taxon_id":     taxon_id,
            "place_id":     place_id,
            "quality_grade": "research",
            "locale":       "nl",
            "per_page":     PER_PAGE,
            "page":         page,
        })
        results   = data.get("results", [])
        total_api = data.get("total_results", 0)

        for item in results:
            taxon    = item.get("taxon", {})
            sci_name = (taxon.get("name") or "").strip()
            if not sci_name:
                continue
            if taxon.get("rank") not in ("species", None):
                continue
            count = item.get("count", 0)
            if sci_name not in results_map or count > results_map[sci_name]["count"]:
                results_map[sci_name] = {"count": count, "taxon": taxon}

        fetched_so_far = page * PER_PAGE
        # Stop als we de limiet bereikt hebben of er niets meer is
        if not results or fetched_so_far >= total_api:
            break
        if max_n and len(results_map) >= max_n * 2:  # buffer: stop vroeg
            break

        page += 1

    return results_map


def fetch_group(label: str, category_nl: str, taxon_id: int,
                template_key: str, max_n: int | None) -> list[dict]:
    """
    Combineert resultaten van alle PLACE_IDS, neemt de hoogste count
    per soort, sorteert en zet om naar BioLoggr-species-dicts.
    """
    print(f"  >> {label} (taxon_id={taxon_id}):")

    combined: dict[str, dict] = {}
    for place_id in PLACE_IDS:
        place_label = "BE" if place_id == 7008 else "NL"
        place_data = fetch_one_place(taxon_id, place_id, max_n)
        print(f"       {place_label}: {len(place_data)} soorten ruwe data")
        for sci, info in place_data.items():
            if sci not in combined or info["count"] > combined[sci]["count"]:
                combined[sci] = info

    # Sorteer op gecombineerde count (meest waargenomen eerst), neem top N
    sorted_items = sorted(combined.items(), key=lambda x: -x[1]["count"])
    if max_n:
        sorted_items = sorted_items[:max_n]

    species: list[dict] = []
    for sci_name, info in sorted_items:
        taxon = info["taxon"]
        count = info["count"]

        nl_name = (taxon.get("preferred_common_name") or "").strip()
        if not nl_name:
            continue  # geen Nederlandse naam → overslaan

        wiki = (taxon.get("wikipedia_summary") or "").strip()
        description = clean_wiki(wiki) if wiki else DESC.get(template_key, "Een inheemse Benelux-soort.")

        species.append({
            "dutch_name":      nl_name.capitalize(),
            "scientific_name": sci_name,
            "category":        category_nl,
            "rarity":          determine_rarity(count),
            "description":     description,
            "image_url":       None,
            "extra_info":      build_extra_info(taxon, template_key),
        })

    print(f"       => {len(species)} soorten met NL-naam")
    return species


# ── Hoofdprogramma ────────────────────────────────────────────────────────────

def main() -> None:
    all_species: list[dict] = []
    seen: set[str] = set()

    for label, cat_nl, taxon_id, tmpl_key, max_n in GROUPS:
        group = fetch_group(label, cat_nl, taxon_id, tmpl_key, max_n)
        for sp in group:
            sci = sp["scientific_name"]
            if sci not in seen:
                seen.add(sci)
                all_species.append(sp)
        print()

    # Sorteer: categorie alfabetisch, dan op Nederlandse naam
    all_species.sort(key=lambda s: (s["category"], s["dutch_name"].lower()))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_species, f, ensure_ascii=False, indent=2)

    # Samenvatting per categorie
    by_cat: dict[str, int] = {}
    for s in all_species:
        by_cat[s["category"]] = by_cat.get(s["category"], 0) + 1
    print("Overzicht per categorie:")
    for cat, n in sorted(by_cat.items()):
        print(f"  {cat}: {n}")
    print(f"\nKLAAR: {len(all_species)} soorten -> {os.path.abspath(OUTPUT_PATH)}")


if __name__ == "__main__":
    main()
