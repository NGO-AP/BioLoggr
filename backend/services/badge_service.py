"""badge_service.py — BioLoggr badge evaluation engine (52 badges).

All badge logic is computed dynamically from the observation + animal data in
SQLite.  Unlock timestamps are persisted in the BadgeUnlock table.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from backend.models import Animal, BadgeUnlock, Observation

# ═══════════════════════════════════════════════════════════════════════════════
# Taxonomic helpers — genus-set primary, dutch_name keyword fallback
# ═══════════════════════════════════════════════════════════════════════════════

def _genus(sci: str) -> str:
    return sci.split()[0].lower()


_BAT_GENERA = {
    "myotis", "pipistrellus", "nyctalus", "rhinolophus", "plecotus",
    "eptesicus", "vespertilio", "barbastella", "miniopterus", "tadarida",
}
_WATER_BIRD_GENERA = {
    "anas", "anser", "branta", "aythya", "bucephala", "mergus", "cygnus",
    "alopochen", "netta", "mareca", "spatula", "somateria", "clangula",
    "melanitta", "oxyura", "tachybaptus", "podiceps", "fulica", "gallinula",
    "porphyrio", "rallus", "crex", "ardea", "egretta", "nycticorax",
    "botaurus", "ixobrychus",
}
_RAPTOR_GENERA = {
    "buteo", "accipiter", "falco", "circus", "milvus", "haliaeetus",
    "pandion", "aquila", "hieraaetus", "pernis", "strix", "asio", "athene",
    "tyto", "bubo", "otus", "aegolius", "glaucidium", "surnia",
}
_SONGBIRD_GENERA = {
    "parus", "cyanistes", "periparus", "lophophanes", "poecile", "aegithalos",
    "remiz", "turdus", "erithacus", "luscinia", "ficedula", "muscicapa",
    "phoenicurus", "saxicola", "oenanthe", "fringilla", "carduelis", "chloris",
    "spinus", "pyrrhula", "coccothraustes", "emberiza", "alauda", "galerida",
    "lullula", "anthus", "motacilla", "cinclus", "troglodytes", "prunella",
    "sylvia", "curruca", "phylloscopus", "acrocephalus", "locustella",
    "cisticola", "regulus", "sitta", "certhia", "lanius", "oriolus", "sturnus",
}
_BUTTERFLY_GENERA = {
    "papilio", "iphiclides", "pieris", "gonepteryx", "colias", "anthocharis",
    "aporia", "lycaena", "polyommatus", "plebejus", "aricia", "cupido",
    "celastrina", "glaucopsyche", "maculinea", "vanessa", "aglais", "nymphalis",
    "argynnis", "boloria", "euphydryas", "melitaea", "pararge", "lasiommata",
    "pyronia", "maniola", "aphantopus", "hipparchia", "erebia", "melanargia",
    "limenitis", "apatura", "charaxes", "hesperia", "thymelicus", "ochlodes",
    "pyrgus", "erynnis", "carterocephalus",
}
_DRAGONFLY_GENERA = {
    "libellula", "sympetrum", "crocothemis", "orthetrum", "leucorrhinia",
    "trithemis", "anax", "aeshna", "brachytron", "gomphus", "cordulia",
    "somatochlora", "coenagrion", "pyrrhosoma", "ceriagrion", "enallagma",
    "ischnura", "erythromma", "platycnemis", "calopteryx", "lestes", "sympecma",
    "lindenia", "onychogomphus",
}
_BEE_GENERA = {
    "bombus", "apis", "andrena", "lasioglossum", "halictus", "colletes",
    "dasypoda", "panurgus", "xylocopa", "eucera", "anthophora", "melitta",
    "osmia", "megachile", "heriades", "chelostoma", "nomia", "sphecodes",
}
_BEETLE_GENERA = {
    "coccinella", "harmonia", "adalia", "propylea", "carabus", "cerambyx",
    "lamia", "lucanus", "dorcus", "melolontha", "cetonia", "oxythyrea",
    "geotrupes", "cantharis", "agrilus", "chrysomela", "rhagium",
    "stictoleptura", "strangalia", "stenurella", "nicrophorus",
}
_LADYBUG_GENERA = {"coccinella", "harmonia", "adalia", "propylea", "chilocorus", "calvia"}
_SNAKE_GENERA = {"vipera", "natrix", "coronella", "zamenis", "elaphe", "hierophis"}
_FROG_GENERA = {
    "rana", "pelophylax", "bombina", "bufo", "epidalea", "bufotes",
    "pelobates", "alytes", "hyla", "xenopus", "lithobates", "discoglossus",
}
_BIG_GAME_GENERA = {
    "capreolus", "cervus", "dama", "rangifer", "alces", "rupicapra", "sus",
}

# Dutch name keyword fallbacks (substring match)
_WATER_BIRD_KW = ["eend", "gans", "zwaan", "fuut", "meerkoet", "reiger"]
_RAPTOR_KW = ["buizerd", "havik", "sperwer", "wouw", "kiekendief", "arend", "visarend", "valk", "uil", "kerkuil", "steenuil"]
_SONGBIRD_KW = ["mees", "merel", "roodborst", "vink", "groenling", "sijs", "lijster", "goudvink", "nachtegaal", "tjiftjaf", "fitis", "goudhaantje", "winterkoning", "heggenmus", "boomklever", "boomkruiper", "wielewaal", "spreeuw"]
_BAT_KW = ["vleermuis"]
_BIG_GAME_KW = ["hert", "everzwijn", "damhert", "moeflon"]
_FROG_KW = ["kikker", "boomkikker"]
_TOAD_KW = ["pad"]
_SNAKE_KW = ["slang", "adder"]
_BUTTERFLY_KW = ["vlinder", "blauwtje", "witje", "parelmoervlinder", "dikkopje", "argusvlinder", "zandoogje", "hooibeestje"]
_DRAGONFLY_KW = ["libel", "juffer", "glazenmaker", "heidelibel", "waterjuffer", "lantaarntje"]
_BEE_KW = ["bij", "hommel"]
_BEETLE_KW = ["kever", "lieveheersbeestje", "tor", "vliegend hert"]
_LADYBUG_KW = ["lieveheersbeestje"]


def _match(animal: Animal, genera: set, kw: list) -> bool:
    if _genus(animal.scientific_name) in genera:
        return True
    name = animal.dutch_name.lower()
    return any(k in name for k in kw)


def _is_bat(a: Animal) -> bool:
    return a.category == "Zoogdieren" and _match(a, _BAT_GENERA, _BAT_KW)

def _is_water_bird(a: Animal) -> bool:
    return a.category == "Vogels" and _match(a, _WATER_BIRD_GENERA, _WATER_BIRD_KW)

def _is_raptor(a: Animal) -> bool:
    return a.category == "Vogels" and _match(a, _RAPTOR_GENERA, _RAPTOR_KW)

def _is_songbird(a: Animal) -> bool:
    return a.category == "Vogels" and _match(a, _SONGBIRD_GENERA, _SONGBIRD_KW)

def _is_big_game(a: Animal) -> bool:
    return a.category == "Zoogdieren" and _match(a, _BIG_GAME_GENERA, _BIG_GAME_KW)

def _is_frog_toad(a: Animal) -> bool:
    return a.category == "Reptielen & Amfibieën" and _match(
        a, _FROG_GENERA, _FROG_KW + _TOAD_KW
    )

def _is_snake(a: Animal) -> bool:
    return a.category == "Reptielen & Amfibieën" and _match(a, _SNAKE_GENERA, _SNAKE_KW)

def _is_butterfly(a: Animal) -> bool:
    return a.category == "Insecten" and _match(a, _BUTTERFLY_GENERA, _BUTTERFLY_KW)

def _is_dragonfly(a: Animal) -> bool:
    return a.category == "Insecten" and _match(a, _DRAGONFLY_GENERA, _DRAGONFLY_KW)

def _is_bee(a: Animal) -> bool:
    return a.category == "Insecten" and _match(a, _BEE_GENERA, _BEE_KW)

def _is_beetle(a: Animal) -> bool:
    return a.category == "Insecten" and _match(a, _BEETLE_GENERA, _BEETLE_KW)

def _is_ladybug(a: Animal) -> bool:
    return a.category == "Insecten" and _match(a, _LADYBUG_GENERA, _LADYBUG_KW)

# ─── Time helpers ────────────────────────────────────────────────────────────

def _is_night(ts: datetime) -> bool:
    """True for observations between 22:00 and 05:00 UTC."""
    h = ts.hour
    return h >= 22 or h < 5

def _is_early(ts: datetime) -> bool:
    """True for observations before 07:30 UTC."""
    return ts.hour < 7 or (ts.hour == 7 and ts.minute < 30)

# ─── Grand Slam helper ───────────────────────────────────────────────────────

def _check_grand_slam(observations: list[Observation], animals: dict[int, Animal]) -> bool:
    """True if on any single calendar day all 4 categories are represented."""
    by_day: dict[str, set] = defaultdict(set)
    for obs in observations:
        animal = animals.get(obs.animal_id)
        if animal:
            by_day[obs.timestamp.date().isoformat()].add(animal.category)
    required = {"Zoogdieren", "Vogels", "Insecten", "Reptielen & Amfibieën"}
    return any(required.issubset(cats) for cats in by_day.values())


# ═══════════════════════════════════════════════════════════════════════════════
# Rarities considered "rare" in the badge logic
# ═══════════════════════════════════════════════════════════════════════════════

_RARE_RARITIES = {"Zeldzaam", "Bedreigd", "Rare", "Epic", "Legendary"}


# ═══════════════════════════════════════════════════════════════════════════════
# Data computation — one pass over observations + animals
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_data(session: Session) -> dict[str, Any]:
    animals: dict[int, Animal] = {a.id: a for a in session.exec(select(Animal)).all()}  # type: ignore[arg-type]
    observations: list[Observation] = list(session.exec(select(Observation)).all())

    total_obs = len(observations)
    wild_obs = sum(1 for o in observations if o.is_wild)
    zoo_obs = sum(1 for o in observations if not o.is_wild)
    gps_obs = sum(1 for o in observations if o.latitude is not None)
    night_obs = sum(1 for o in observations if _is_night(o.timestamp))
    early_obs = sum(1 for o in observations if _is_early(o.timestamp))

    animal_obs_counts: dict[int, int] = defaultdict(int)
    for o in observations:
        animal_obs_counts[o.animal_id] += 1
    max_same_animal = max(animal_obs_counts.values(), default=0)

    observed_ids: set[int] = set(animal_obs_counts.keys())
    wild_ids: set[int] = {o.animal_id for o in observations if o.is_wild}

    ai_90 = sum(1 for o in observations if o.confidence >= 0.90)
    ai_80 = sum(1 for o in observations if o.confidence >= 0.80)
    ai_95 = sum(1 for o in observations if o.confidence >= 0.95)

    def _cat(cat: str) -> set[int]:
        return {aid for aid in observed_ids if animals.get(aid) and animals[aid].category == cat}

    birds_ids = _cat("Vogels")
    mammals_ids = _cat("Zoogdieren")
    reptiles_ids = _cat("Reptielen & Amfibieën")
    insects_ids = _cat("Insecten")

    rare_ids = {aid for aid in observed_ids if animals.get(aid) and animals[aid].rarity in _RARE_RARITIES}
    wild_rare_ids = {aid for aid in wild_ids if animals.get(aid) and animals[aid].rarity in _RARE_RARITIES}

    def _taxo(base: set[int], fn) -> int:
        return sum(1 for aid in base if animals.get(aid) and fn(animals[aid]))

    total_codex = len(animals)
    reptile_codex = sum(1 for a in animals.values() if a.category == "Reptielen & Amfibieën")

    return {
        "total_obs": total_obs,
        "wild_obs": wild_obs,
        "zoo_obs": zoo_obs,
        "gps_obs": gps_obs,
        "night_obs": night_obs,
        "early_obs": early_obs,
        "max_same_animal": max_same_animal,
        "unique_observed": len(observed_ids),
        "wild_unique": len(wild_ids),
        "ai_90": ai_90,
        "ai_80": ai_80,
        "ai_95": ai_95,
        "birds": len(birds_ids),
        "mammals": len(mammals_ids),
        "reptiles": len(reptiles_ids),
        "insects": len(insects_ids),
        "rare_unique": len(rare_ids),
        "wild_rare_unique": len(wild_rare_ids),
        "water_birds": _taxo(birds_ids, _is_water_bird),
        "raptors": _taxo(birds_ids, _is_raptor),
        "songbirds": _taxo(birds_ids, _is_songbird),
        "bats": _taxo(mammals_ids, _is_bat),
        "big_game": _taxo(mammals_ids, _is_big_game),
        "frogs": _taxo(reptiles_ids, _is_frog_toad),
        "snakes": _taxo(reptiles_ids, _is_snake),
        "butterflies": _taxo(insects_ids, _is_butterfly),
        "dragonflies": _taxo(insects_ids, _is_dragonfly),
        "bees": _taxo(insects_ids, _is_bee),
        "beetles": _taxo(insects_ids, _is_beetle),
        "ladybugs": _taxo(insects_ids, _is_ladybug),
        "total_codex": total_codex,
        "reptile_codex": reptile_codex,
        "grand_slam": _check_grand_slam(observations, animals),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Badge registry — 52 badges
# Each "check" returns (unlocked: bool, current: int, target: int)
# ═══════════════════════════════════════════════════════════════════════════════

def _mk(d, key, target):
    """Helper: simple threshold badge."""
    v = d[key]
    return v >= target, v, target

BADGE_REGISTRY: list[dict] = [
    # ── VELDWERK & EXPEDITIE ─────────────────────────────────────────────────
    {
        "id": "first_discovery",
        "title": "De Eerste Pootafdruk",
        "description": "Registreer je allereerste dier in de codex.",
        "category": "veldwerk",
        "icon": "🐾",
        "is_challenge": False,
        "check": lambda d: _mk(d, "total_obs", 1),
    },
    {
        "id": "tracker_wild_1",
        "title": "Spoorzoeker",
        "description": "Registreer 5 wilde waarnemingen.",
        "category": "veldwerk",
        "icon": "🌿",
        "is_challenge": False,
        "check": lambda d: _mk(d, "wild_obs", 5),
    },
    {
        "id": "tracker_wild_2",
        "title": "Echte Freek",
        "description": "Registreer 25 wilde waarnemingen.",
        "category": "veldwerk",
        "icon": "🦺",
        "is_challenge": False,
        "check": lambda d: _mk(d, "wild_obs", 25),
    },
    {
        "id": "tracker_wild_3",
        "title": "Expeditieleider",
        "description": "Registreer 50 wilde waarnemingen.",
        "category": "veldwerk",
        "icon": "🧭",
        "is_challenge": False,
        "check": lambda d: _mk(d, "wild_obs", 50),
    },
    {
        "id": "tracker_wild_4",
        "title": "Wildernispionier",
        "description": "Registreer 100 wilde waarnemingen.",
        "category": "veldwerk",
        "icon": "🏕️",
        "is_challenge": False,
        "check": lambda d: _mk(d, "wild_obs", 100),
    },
    {
        "id": "zoo_explorer_1",
        "title": "Zondagsuitje",
        "description": "Registreer 5 waarnemingen in een dierentuin of opvang.",
        "category": "veldwerk",
        "icon": "🏛️",
        "is_challenge": False,
        "check": lambda d: _mk(d, "zoo_obs", 5),
    },
    {
        "id": "zoo_explorer_2",
        "title": "Seizoenspashouder",
        "description": "Registreer 20 waarnemingen in een dierentuin of opvang.",
        "category": "veldwerk",
        "icon": "🎫",
        "is_challenge": False,
        "check": lambda d: _mk(d, "zoo_obs", 20),
    },
    {
        "id": "cartographer_1",
        "title": "Kaartlezer",
        "description": "Leg de locatie vast bij 5 waarnemingen.",
        "category": "veldwerk",
        "icon": "🗺️",
        "is_challenge": False,
        "check": lambda d: _mk(d, "gps_obs", 5),
    },
    {
        "id": "cartographer_2",
        "title": "Levende Wereldkaart",
        "description": "Leg de locatie vast bij 25 waarnemingen.",
        "category": "veldwerk",
        "icon": "🌍",
        "is_challenge": False,
        "check": lambda d: _mk(d, "gps_obs", 25),
    },
    {
        "id": "cartographer_3",
        "title": "Globetrotter",
        "description": "Leg de locatie vast bij 50 waarnemingen.",
        "category": "veldwerk",
        "icon": "✈️",
        "is_challenge": False,
        "check": lambda d: _mk(d, "gps_obs", 50),
    },
    {
        "id": "night_owl_1",
        "title": "Nachtbraker",
        "description": "Registreer minstens 1 waarneming tussen 22:00 en 05:00.",
        "category": "veldwerk",
        "icon": "🦉",
        "is_challenge": False,
        "check": lambda d: _mk(d, "night_obs", 1),
    },
    {
        "id": "night_owl_2",
        "title": "Schemerjager",
        "description": "Registreer 5 waarnemingen tussen 22:00 en 05:00.",
        "category": "veldwerk",
        "icon": "🌙",
        "is_challenge": False,
        "check": lambda d: _mk(d, "night_obs", 5),
    },
    {
        "id": "early_bird_time",
        "title": "Dauwtrapper",
        "description": "Registreer een waarneming vóór 07:30 uur.",
        "category": "veldwerk",
        "icon": "🌅",
        "is_challenge": False,
        "check": lambda d: _mk(d, "early_obs", 1),
    },
    {
        "id": "familiar_face_1",
        "title": "Oude Bekende",
        "description": "Registreer 2 of meer waarnemingen van hetzelfde dier.",
        "category": "veldwerk",
        "icon": "👀",
        "is_challenge": False,
        "check": lambda d: _mk(d, "max_same_animal", 2),
    },
    {
        "id": "familiar_face_2",
        "title": "Veldstudie",
        "description": "Registreer 5 of meer waarnemingen van hetzelfde dier.",
        "category": "veldwerk",
        "icon": "🔭",
        "is_challenge": False,
        "check": lambda d: _mk(d, "max_same_animal", 5),
    },
    # ── VOGELS ───────────────────────────────────────────────────────────────
    {
        "id": "bird_novice",
        "title": "Vroege Vogel",
        "description": "Ontdek 3 unieke vogelsoorten.",
        "category": "vogels",
        "icon": "🐦",
        "is_challenge": False,
        "check": lambda d: _mk(d, "birds", 3),
    },
    {
        "id": "bird_twitcher",
        "title": "Meester Twitcher",
        "description": "Ontdek 15 unieke vogelsoorten.",
        "category": "vogels",
        "icon": "🦜",
        "is_challenge": False,
        "check": lambda d: _mk(d, "birds", 15),
    },
    {
        "id": "bird_water",
        "title": "Waterrat",
        "description": "Ontdek 3 soorten watervogels (eenden, ganzen, futen, zwanen, reigers).",
        "category": "vogels",
        "icon": "🦆",
        "is_challenge": False,
        "check": lambda d: _mk(d, "water_birds", 3),
    },
    {
        "id": "bird_raptor",
        "title": "Luchtheerser",
        "description": "Ontdek 2 roofvogels of uilen.",
        "category": "vogels",
        "icon": "🦅",
        "is_challenge": False,
        "check": lambda d: _mk(d, "raptors", 2),
    },
    {
        "id": "bird_song",
        "title": "Zanglijster",
        "description": "Ontdek 5 kleine zangvogels (mezen, vinken, meerlen, roodborst).",
        "category": "vogels",
        "icon": "🎵",
        "is_challenge": False,
        "check": lambda d: _mk(d, "songbirds", 5),
    },
    {
        "id": "bird_master",
        "title": "Gevleugelde Meester",
        "description": "Ontdek 30 unieke vogelsoorten.",
        "category": "vogels",
        "icon": "🦢",
        "is_challenge": False,
        "check": lambda d: _mk(d, "birds", 30),
    },
    # ── LANDDIEREN ───────────────────────────────────────────────────────────
    {
        "id": "mammal_novice",
        "title": "Sluipende Jager",
        "description": "Ontdek 3 unieke zoogdiersoorten.",
        "category": "landdieren",
        "icon": "🦊",
        "is_challenge": False,
        "check": lambda d: _mk(d, "mammals", 3),
    },
    {
        "id": "mammal_pro",
        "title": "Snorhaar & Stekels",
        "description": "Ontdek 10 unieke zoogdiersoorten.",
        "category": "landdieren",
        "icon": "🦔",
        "is_challenge": False,
        "check": lambda d: _mk(d, "mammals", 10),
    },
    {
        "id": "mammal_bat",
        "title": "Radar & Echo",
        "description": "Ontdek minstens 1 vleermuissoort.",
        "category": "landdieren",
        "icon": "🦇",
        "is_challenge": False,
        "check": lambda d: _mk(d, "bats", 1),
    },
    {
        "id": "mammal_big_game",
        "title": "Groot Wild",
        "description": "Ontdek een hertachtige of wild zwijn.",
        "category": "landdieren",
        "icon": "🦌",
        "is_challenge": False,
        "check": lambda d: _mk(d, "big_game", 1),
    },
    {
        "id": "amphibia_frog",
        "title": "Paddenprins",
        "description": "Ontdek minstens 1 kikker- of paddensoort.",
        "category": "landdieren",
        "icon": "🐸",
        "is_challenge": False,
        "check": lambda d: _mk(d, "frogs", 1),
    },
    {
        "id": "herpeto_novice",
        "title": "Koudbloedig",
        "description": "Ontdek 3 unieke soorten reptielen of amfibieën.",
        "category": "landdieren",
        "icon": "🦎",
        "is_challenge": False,
        "check": lambda d: _mk(d, "reptiles", 3),
    },
    {
        "id": "herpeto_snake",
        "title": "Slangenbezweerder",
        "description": "Ontdek een ringslang, gladde slang of adder.",
        "category": "landdieren",
        "icon": "🐍",
        "is_challenge": False,
        "check": lambda d: _mk(d, "snakes", 1),
    },
    {
        "id": "herpeto_pro",
        "title": "Terrarium Meester",
        "description": "Ontdek 6 unieke soorten reptielen of amfibieën.",
        "category": "landdieren",
        "icon": "🐊",
        "is_challenge": False,
        "check": lambda d: _mk(d, "reptiles", 6),
    },
    # ── INSECTEN ─────────────────────────────────────────────────────────────
    {
        "id": "insect_novice",
        "title": "Kriebelbeestjes",
        "description": "Ontdek 5 unieke insectensoorten.",
        "category": "insecten",
        "icon": "🐛",
        "is_challenge": False,
        "check": lambda d: _mk(d, "insects", 5),
    },
    {
        "id": "butterfly_novice",
        "title": "Vlindereffect",
        "description": "Ontdek 5 unieke dagvlindersoorten.",
        "category": "insecten",
        "icon": "🦋",
        "is_challenge": False,
        "check": lambda d: _mk(d, "butterflies", 5),
    },
    {
        "id": "butterfly_master",
        "title": "Vlinderverzamelaar",
        "description": "Ontdek 15 unieke dagvlindersoorten.",
        "category": "insecten",
        "icon": "🌸",
        "is_challenge": False,
        "check": lambda d: _mk(d, "butterflies", 15),
    },
    {
        "id": "dragonfly_novice",
        "title": "Helikopterpiloot",
        "description": "Ontdek 3 unieke libellen- of juffersoorten.",
        "category": "insecten",
        "icon": "🚁",
        "is_challenge": False,
        "check": lambda d: _mk(d, "dragonflies", 3),
    },
    {
        "id": "dragonfly_master",
        "title": "Groot Libellenjager",
        "description": "Ontdek 8 unieke libellen- of juffersoorten.",
        "category": "insecten",
        "icon": "💎",
        "is_challenge": False,
        "check": lambda d: _mk(d, "dragonflies", 8),
    },
    {
        "id": "insect_bee",
        "title": "Bezig Bijtje",
        "description": "Ontdek 3 soorten wilde bijen of hommels.",
        "category": "insecten",
        "icon": "🐝",
        "is_challenge": False,
        "check": lambda d: _mk(d, "bees", 3),
    },
    {
        "id": "insect_beetle",
        "title": "Pantserdivisie",
        "description": "Ontdek 5 verschillende keversoorten.",
        "category": "insecten",
        "icon": "🪲",
        "is_challenge": False,
        "check": lambda d: _mk(d, "beetles", 5),
    },
    {
        "id": "insect_ladybug",
        "title": "Lieveheerser",
        "description": "Ontdek een lieveheersbeestje.",
        "category": "insecten",
        "icon": "🐞",
        "is_challenge": False,
        "check": lambda d: _mk(d, "ladybugs", 1),
    },
    # ── MIJLPALEN & AI-TECHNOLOGIE ───────────────────────────────────────────
    {
        "id": "rare_first",
        "title": "Scherp Oog",
        "description": "Ontdek een zeldzame of bedreigde soort.",
        "category": "mijlpalen",
        "icon": "💫",
        "is_challenge": False,
        "check": lambda d: _mk(d, "rare_unique", 1),
    },
    {
        "id": "rare_trio",
        "title": "Goudhaantje",
        "description": "Ontdek 3 unieke zeldzame of bedreigde soorten.",
        "category": "mijlpalen",
        "icon": "⭐",
        "is_challenge": False,
        "check": lambda d: _mk(d, "rare_unique", 3),
    },
    {
        "id": "rare_penta",
        "title": "Witte Raaf",
        "description": "Ontdek 5 unieke zeldzame of bedreigde soorten.",
        "category": "mijlpalen",
        "icon": "🌟",
        "is_challenge": False,
        "check": lambda d: _mk(d, "rare_unique", 5),
    },
    {
        "id": "ai_sharp",
        "title": "Haarscherp",
        "description": "Laat de AI een dier identificeren met ≥ 90% betrouwbaarheid.",
        "category": "mijlpalen",
        "icon": "🎯",
        "is_challenge": False,
        "check": lambda d: _mk(d, "ai_90", 1),
    },
    {
        "id": "ai_whisperer",
        "title": "AI Fluisteraar",
        "description": "10 waarnemingen met een AI-score van ≥ 80%.",
        "category": "mijlpalen",
        "icon": "🤖",
        "is_challenge": False,
        "check": lambda d: _mk(d, "ai_80", 10),
    },
    {
        "id": "all_rounder_1",
        "title": "Fauna Fenomeen",
        "description": "Ontdek minstens 1 dier in elk van de 4 categorieën.",
        "category": "mijlpalen",
        "icon": "🌈",
        "is_challenge": False,
        "check": lambda d: (
            all(d[k] >= 1 for k in ["birds", "mammals", "insects", "reptiles"]),
            sum(min(d[k], 1) for k in ["birds", "mammals", "insects", "reptiles"]),
            4,
        ),
    },
    {
        "id": "all_rounder_5",
        "title": "Perfect Evenwicht",
        "description": "Ontdek minstens 5 dieren in elk van de 4 categorieën.",
        "category": "mijlpalen",
        "icon": "⚖️",
        "is_challenge": False,
        "check": lambda d: (
            all(d[k] >= 5 for k in ["birds", "mammals", "insects", "reptiles"]),
            sum(min(d[k], 5) for k in ["birds", "mammals", "insects", "reptiles"]),
            20,
        ),
    },
    {
        "id": "codex_50",
        "title": "Veldgids Veteraan",
        "description": "Ontdek 50 unieke soorten in de codex.",
        "category": "mijlpalen",
        "icon": "📖",
        "is_challenge": False,
        "check": lambda d: _mk(d, "unique_observed", 50),
    },
    # ── 🔥 UITDAGINGEN ────────────────────────────────────────────────────────
    {
        "id": "encyclopedia_master",
        "title": "Levende Encyclopedie",
        "description": "Ontdek 100% van alle dieren in de Codex.",
        "category": "mijlpalen",
        "icon": "📚",
        "is_challenge": True,
        "check": lambda d: (
            d["total_codex"] > 0 and d["unique_observed"] >= d["total_codex"],
            d["unique_observed"],
            d["total_codex"],
        ),
    },
    {
        "id": "herpeto_complete",
        "title": "Herpetofauna Meester",
        "description": "Ontdek 100% van alle soorten Reptielen & Amfibieën in de Codex.",
        "category": "landdieren",
        "icon": "🏆",
        "is_challenge": True,
        "check": lambda d: (
            d["reptile_codex"] > 0 and d["reptiles"] >= d["reptile_codex"],
            d["reptiles"],
            d["reptile_codex"],
        ),
    },
    {
        "id": "pure_nature_50",
        "title": "100% Puur Natuur",
        "description": "Ontdek 50 unieke soorten uitsluitend in het wild.",
        "category": "veldwerk",
        "icon": "🌲",
        "is_challenge": True,
        "check": lambda d: _mk(d, "wild_unique", 50),
    },
    {
        "id": "rare_hunter_10",
        "title": "Witte Raaf Brigade",
        "description": "Ontdek 10 unieke zeldzame soorten in het wild.",
        "category": "mijlpalen",
        "icon": "🦅",
        "is_challenge": True,
        "check": lambda d: _mk(d, "wild_rare_unique", 10),
    },
    {
        "id": "grand_slam_day",
        "title": "De Veldwerk Grand Slam",
        "description": "Spot op dezelfde dag minstens 1 zoogdier, 1 vogel, 1 insect én 1 amfibie/reptiel.",
        "category": "veldwerk",
        "icon": "🎰",
        "is_challenge": True,
        "check": lambda d: (d["grand_slam"], 1 if d["grand_slam"] else 0, 1),
    },
    {
        "id": "bioclip_perfection",
        "title": "Biologische Perfectie",
        "description": "10 waarnemingen met een AI-score van ≥ 95%.",
        "category": "mijlpalen",
        "icon": "💯",
        "is_challenge": True,
        "check": lambda d: _mk(d, "ai_95", 10),
    },
    {
        "id": "species_centurion",
        "title": "Heer en Meester van het Rijk",
        "description": "Ontdek 100 unieke soorten in de codex.",
        "category": "mijlpalen",
        "icon": "👑",
        "is_challenge": True,
        "check": lambda d: _mk(d, "unique_observed", 100),
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════

def evaluate_unlocked_badge_ids(session: Session) -> set[str]:
    """Return the set of badge IDs that are currently unlocked.

    Read-only — does NOT write to the BadgeUnlock table.
    Used for before/after diff in the observations endpoint.
    """
    data = _compute_data(session)
    return {b["id"] for b in BADGE_REGISTRY if b["check"](data)[0]}


def get_badges_with_progress(session: Session) -> list[dict]:
    """Compute progress for all 52 badges and persist new unlock timestamps."""
    data = _compute_data(session)

    # Load existing unlock records
    unlocks: dict[str, BadgeUnlock] = {
        u.badge_id: u for u in session.exec(select(BadgeUnlock)).all()
    }

    result = []
    for badge in BADGE_REGISTRY:
        unlocked, current, target = badge["check"](data)

        # Persist unlock timestamp if newly earned
        if unlocked and badge["id"] not in unlocks:
            new_unlock = BadgeUnlock(
                badge_id=badge["id"],
                unlocked_at=datetime.now(timezone.utc),
            )
            session.add(new_unlock)
            session.commit()
            session.refresh(new_unlock)
            unlocks[badge["id"]] = new_unlock

        unlock_record = unlocks.get(badge["id"])
        pct = min(100, int(current / target * 100)) if target > 0 else (100 if unlocked else 0)

        result.append({
            "id": badge["id"],
            "title": badge["title"],
            "description": badge["description"],
            "category": badge["category"],
            "icon": badge["icon"],
            "is_challenge": badge["is_challenge"],
            "unlocked": unlocked,
            "current": current,
            "target": target,
            "percentage": pct,
            "unlocked_at": unlock_record.unlocked_at.isoformat() if unlock_record else None,
        })

    return result


def get_stats(session: Session) -> dict:
    """Return aggregated stats for the stats dashboard."""
    data = _compute_data(session)
    unlocked_ids = evaluate_unlocked_badge_ids(session)

    challenge_total = sum(1 for b in BADGE_REGISTRY if b["is_challenge"])
    challenge_unlocked = sum(1 for b in BADGE_REGISTRY if b["is_challenge"] and b["id"] in unlocked_ids)

    return {
        "total_observed": data["unique_observed"],
        "total_codex": data["total_codex"],
        "total_observations": data["total_obs"],
        "wild_observations": data["wild_obs"],
        "zoo_observations": data["zoo_obs"],
        "by_category": {
            "Vogels": data["birds"],
            "Zoogdieren": data["mammals"],
            "Insecten": data["insects"],
            "Reptielen & Amfibieën": data["reptiles"],
        },
        "badges_unlocked": len(unlocked_ids),
        "badges_total": len(BADGE_REGISTRY),
        "challenges_unlocked": challenge_unlocked,
        "challenges_total": challenge_total,
    }


def record_new_unlocks(session: Session, new_ids: set[str]) -> list[dict]:
    """Persist BadgeUnlock records for newly unlocked badges.

    Returns list of badge summary dicts for the newly unlocked badges.
    """
    existing = {u.badge_id for u in session.exec(select(BadgeUnlock)).all()}
    summaries = []
    badge_map = {b["id"]: b for b in BADGE_REGISTRY}

    for bid in new_ids:
        if bid not in existing:
            session.add(BadgeUnlock(badge_id=bid, unlocked_at=datetime.now(timezone.utc)))
        b = badge_map.get(bid)
        if b:
            summaries.append({
                "id": b["id"],
                "title": b["title"],
                "description": b["description"],
                "icon": b["icon"],
                "is_challenge": b["is_challenge"],
            })

    session.commit()
    return summaries
