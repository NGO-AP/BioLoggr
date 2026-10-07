# BioLoggr — Prompt- en Voortgangsplan

Dit document bevat het gestructureerde overzicht van uitgevoerde mijlpalen, het prompt logboek en de geplande vervolgprompts (roadmap) voor de ontwikkeling van de BioLoggr applicatie.

---

## Deel 1: Uitgevoerde Mijlpalen & Prompt Logboek

- **Mijlpaal 1: Specificaties & Architectuur**
  - **Doel:** Opstellen van een volledige specificatie en architectuur voor de applicatie.
  - **Prompt / Actie:** Opstellen van [`SPEC.md`](SPEC.md) met functionele vereisten, datamodellen (Animal, Observation, Badge), mock-AI integratie en REST-endpoints.
  - **Validatie:** Geverifieerd op volledigheid en consistentie met de tech stack.

- **Mijlpaal 2: Backend Implementatie**
  - **Doel:** Realiseren van de FastAPI backend met SQLite en SQLModel.
  - **Prompt / Actie:** Aanmaken van [`backend/database.py`](backend/database.py), [`backend/models.py`](backend/models.py) (inclusief het flexibele `extra_info` JSON-veld) en [`backend/main.py`](backend/main.py).
  - **Validatie:** Backend start correct en exposeert alle gedefinieerde REST API endpoints.

- **Mijlpaal 3: Backend Bugfix & Geautomatiseerde Tests**
  - **Doel:** Oplossen van datamodel relatieproblemen en garanderen van backendstabiliteit.
  - **Prompt / Actie:** Herstel van `back_populates` relaties in [`backend/models.py`](backend/models.py) en toevoegen/uitvoeren van [`backend/tests/test_api.py`](backend/tests/test_api.py).
  - **Validatie:** 4/4 geslaagde `pytest` tests [`backend/tests/test_api.py`](backend/tests/test_api.py).

- **Mijlpaal 4: Frontend Initialisatie**
  - **Doel:** Bootstrap van het Angular frontend-project volgens moderne standaarden.
  - **Prompt / Actie:** Initialiseren van Angular in [`frontend/`](frontend/), vastleggen van moderne `angular.dev` standaarden in [`frontend/.clinerules`](frontend/.clinerules), en opzetten van [`frontend/src/app/services/api.service.ts`](frontend/src/app/services/api.service.ts).
  - **Validatie:** Projectstructuur voldoet aan de eisen en communiceert met de backend service.

- **Mijlpaal 5: Frontend Configuratie & Styling Fixes**
  - **Doel:** Oplossen van configuratie- en stylingproblemen in Angular en Tailwind v4.
  - **Prompt / Actie:** Oplossen van NG0908 via `provideZonelessChangeDetection` in [`frontend/src/app/app.config.ts`](frontend/src/app/app.config.ts), en instellen van PostCSS (`[@tailwindcss/postcss`](frontend/.postcssrc.json)) in [`frontend/src/styles.css`](frontend/src/styles.css).
  - **Validatie:** Succesvolle productiebuild (`npm run build`).

- **Mijlpaal 6: Codex Overzicht**
  - **Doel:** Implementeren van het hoofdscherm om ontdekte diersoorten weer te geven.
  - **Prompt / Actie:** Bouwen van [`frontend/src/app/pages/codex/codex.component.ts`](frontend/src/app/pages/codex/codex.component.ts) met Signals, `@for`/`@if` control flow en responsieve dierkaarten.
  - **Validatie:** Visuele en functionele weergave van de codex met ontdekte en onbekende dieren.

---

## Deel 2: Geplande Vervolgprompts (Roadmap)

- **Prompt 3.1: Upload Interface & State**
  - **Doel:** Aanmaken van de observatiepagina met uploadmogelijkheid.
  - **Prompt / Actie:** 
    ```text
    Maak het component 'frontend/src/app/pages/observe/observe.component.ts' aan met een drag-and-drop fotoselectiezone, live image preview, een notitieveld voor observatiedetails, en lokale reactive state (Signals) voor de geselecteerde afbeelding en formulierinvoer. Voeg tevens de router-route toe in frontend/src/app/app.routes.ts.
    ```

- **Prompt 3.2: API & Mock-AI Integratie**
  - **Doel:** Koppelen van het uploadformulier aan de backend REST API en tonen van herkenningsresultaten.
  - **Prompt / Actie:**
    ```text
    Koppel het uploadformulier in observe.component.ts via ApiService aan de POST /api/observations endpoint met FormData. Implementeer na een succesvolle upload de weergave van het herkenningsresultaat (geïdentificeerd dier, confidence score, en extra_info) en een melding van nieuw ontgrendelde badges.
    ```

- **Prompt 3.3: Gamificatie & Badges**
  - **Doel:** Uitbreiden van de gamificatie-ervaring met een dedicated badges-overzicht.
  - **Prompt / Actie:**
    ```text
    Bouw het component 'frontend/src/app/pages/badges/badges.component.ts' en koppel dit aan de GET /api/badges endpoint. Toon een overzicht van alle behaalde en nog te ontgrendelen badges met visuele indicators (icoon, beschrijving, ontgrendelstatus).
    ```

- **Prompt 3.4: Geautomatiseerde Frontend Verificatie**
  - **Doel:** Waarborgen van de frontendkwaliteit door middel van geautomatiseerde tests en builds.
  - **Prompt / Actie:**
    ```text
    Schrijf unit tests in 'frontend/src/app/services/api.service.spec.ts' en component spec files voor ApiService en de nieuwe schermen. Voer vervolgens 'npm run build' uit in de frontend map om te valideren dat er geen TypeScript- of bundelfouten aanwezig zijn.
    ```
