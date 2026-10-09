# 🌿 BioLoggr

> Een interactieve natuurgids die AI-herkenning, een biologische codex en een gamificatiesysteem combineert tot een persoonlijk logboek van waargenomen dieren.

BioLoggr laat natuurliefhebbers, (natuur)fotografen en wandelaars toe om foto's te uploaden, dieren automatisch te laten identificeren en elke waarneming bij te houden op een persoonlijke codex. Zeldzame soorten blijven verborgen achter een mysterie-silhouet totdat ze effectief gespot worden — een incentive die verkenning aanmoedigt.

---

## Kernfunctionaliteiten

### 🦊 Dieren Codex
- **Overzicht** van alle diersoorten, gefilterd op taxonomische klasse (Zoogdieren, Vogels) of ontdekkingsstatus.
- **Zoekbalk** om real-time te filteren op Nederlandse of wetenschappelijke naam.
- **Mysterie-silhouetten**: niet-ontdekte dieren worden weergegeven als verduisterde kaarten met een 🔒-indicator — de identiteit blijft verborgen tot de eerste waarneming.
- **Biologisch detailpaspoort**: ontdekte soorten onthullen een volledig biologisch paspoort met habitat, dieet, afmetingen, voortplanting en bedreigingsstatus.

### 📸 Observaties & AI-herkenning
- Upload een foto via drag-and-drop of bestandskeuze.
- De **mock-AI classificatie** analyseert de afbeelding en retourneert een wetenschappelijke naam en een **betrouwbaarheidsscore** (confidence %).
- EXIF-data wordt uitgelezen om GPS-coördinaten automatisch in te vullen (voorbereid voor BioCLIP/PyTorch integratie in v2).
- De waarneming wordt opgeslagen met tijdstip, locatie en notities.

### 🏆 Gamificatie & Badges
- Badges worden **automatisch ontgrendeld** op basis van observatiegedrag:
  - 🏆 **Eerste Waarneming** — bij het registreren van het eerste dier
  - 🌙 **Nachtvlinder** — voor het vinden van een zeldzame soort
  - 🌲 **Boswachter** — voor het ontdekken van alle algemene dieren
- Behaalde badges tonen een ontgrendelingsdatum; vergrendelde badges tonen een gesloten slot.

---

## Tech Stack & Architectuur

### Frontend
| Technologie | Versie | Rol |
|---|---|---|
| Angular | 22.x | SPA-framework |
| TypeScript | ~6.0 | Taal |
| Tailwind CSS | v4 | Utility-first styling |
| RxJS | ~7.8 | Async datastromen |

**Moderne Angular-patronen toegepast:**
- **Standalone Components** — geen NgModules
- **Signals** (`signal`, `computed`) voor reactief state management
- **Zoneless Change Detection** via `provideZonelessChangeDetection()`
- `@for` / `@if` / `@empty` control flow syntax (Angular 17+)

### Backend
| Technologie | Versie | Rol |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | ≥0.110 | REST API-framework |
| SQLModel | ≥0.0.16 | ORM (combineert SQLAlchemy + Pydantic) |
| SQLite | — | Lokale database (`biologgr.db`) |
| Uvicorn | ≥0.28 | ASGI-server |
| Pillow / piexif | — | Beeldverwerking & EXIF-extractie |

### Architectuur
```
Biologgr/
├── backend/
│   ├── main.py          # FastAPI app, routes, mock-AI, seeding
│   ├── models.py        # SQLModel datamodellen (Animal, Observation, Badge)
│   ├── database.py      # Engine, sessie en initialisatie
│   ├── uploads/         # Lokale fotoopslag
│   └── tests/
│       └── test_api.py  # Pytest integratietests
└── frontend/
    └── src/app/
        ├── pages/
        │   ├── codex/   # Dieren Codex pagina
        │   ├── observe/ # Observatie-upload pagina
        │   └── badges/  # Badges overzicht
        └── services/
            └── api.service.ts  # HTTP-client naar backend
```

**Communicatie** verloopt uitsluitend via REST JSON endpoints. Backend en frontend zijn strikt gescheiden.

---

## Installatie & Lokaal starten

### Vereisten
- Python 3.11+
- Node.js 20+ met npm

### Backend

```bash
# 1. Navigeer naar de backend
cd backend

# 2. Maak een virtuele omgeving aan en activeer die
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 3. Installeer de dependencies
pip install -r requirements.txt

# 4. Start de API-server (vanuit de root van het project)
cd ..
uvicorn backend.main:app --reload
```

De API is beschikbaar op `http://localhost:8000`.  
Interactieve documentatie: `http://localhost:8000/docs`

### Frontend

```bash
# 1. Navigeer naar de frontend
cd frontend

# 2. Installeer de npm-dependencies
npm install

# 3. Start de ontwikkelserver
npm start
```

De app is beschikbaar op `http://localhost:4200`.

---

## API Endpoints

| Methode | Pad | Beschrijving |
|---|---|---|
| `GET` | `/api/health` | Statuscontrole |
| `GET` | `/api/codex` | Alle dieren met laatste observatie |
| `GET` | `/api/codex/{id}` | Detailweergave van één dier |
| `POST` | `/api/observations` | Nieuwe observatie aanmaken (foto-upload) |
| `GET` | `/api/observations` | Alle opgeslagen observaties |
| `GET` | `/api/badges` | Alle badges met ontgrendelingsstatus |

---

## Datamodel

```
Animal          Observation         Badge
────────        ─────────────       ──────────────
id              id                  id
scientific_name animal_id (FK)      name
dutch_name      latitude            description
category        longitude           icon
rarity          image_path          unlocked_at
description     timestamp
image_url       confidence
extra_info (JSON) notes
```

Het `extra_info`-veld is een flexibel JSON-veld per diersoort met biologische metadata (habitat, dieet, afmetingen, voortplanting, bedreigingsstatus).

---

## Kwaliteitsborging

### Backend — pytest

```bash
# Vanuit de root van het project (venv actief)
pytest backend/tests/test_api.py -v
```

De testsuite omvat 4 integratietests op een in-memory SQLite database:
- `test_health_check` — API bereikbaar
- `test_get_codex` — codex retourneert correcte dierdata inclusief `extra_info`
- `test_get_badges` — badges worden correct opgehaald
- `test_create_observation` — foto-upload, mock-AI classificatie en observatieopslag

### Frontend — Angular

```bash
cd frontend

# Unit tests uitvoeren (Karma + Jasmine)
npm test

# Productiebuild verifiëren (zonder fouten of waarschuwingen)
npm run build
```

Unit tests zijn aanwezig voor `ApiService`, `ObserveComponent` en `BadgesComponent`.

---

## Documentatie & Ontwerpproces

| Bestand | Inhoud |
|---|---|
| [`SPEC.md`](SPEC.md) | Volledige functionele vereisten, datamodellen, architectuurkeuzes en scope-afbakening |
| [`prompts.md`](prompts.md) | Iteratief ontwikkeltraject: alle mijlpalen, uitgevoerde prompts, validaties en de toekomstige roadmap |

---

## Toekomstige uitbreidingen (v2+)

- **BioCLIP** (PyTorch) als echte AI-identificatiemodel ter vervanging van de mock
- **Interactieve kaart** met pinpoints van alle waarnemingen
- **Cloudflare R2** voor fotoopslag in de cloud
- **Accountsysteem** voor meerdere gebruikers
- **PostGIS** voor geavanceerde geo-queries
