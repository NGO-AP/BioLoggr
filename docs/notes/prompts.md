# BioLoggr — Prompt- en Voortgangsplan

Dit document bevat het gestructureerde overzicht van uitgevoerde mijlpalen, het prompt logboek en eventuele toekomstige vervolgstappen voor de ontwikkeling van de BioLoggr applicatie.

---

## Deel 1: Uitgevoerde Mijlpalen & Prompt Logboek

- **Mijlpaal 1: Specificaties & Architectuur**
  - **Doel:** Opstellen van een volledige specificatie en architectuur voor de applicatie.
  - **Prompt / Actie:** Opstellen van [`SPEC.md`](../../SPEC.md) met functionele vereisten, datamodellen (Animal, Observation, Badge), mock-AI integratie en REST-endpoints.
  - **Validatie:** Geverifieerd op volledigheid en consistentie met de tech stack.

- **Mijlpaal 2: Backend Implementatie**
  - **Doel:** Realiseren van de FastAPI backend met SQLite en SQLModel.
  - **Prompt / Actie:** Aanmaken van [`backend/database.py`](../../backend/database.py), [`backend/models.py`](../../backend/models.py) (inclusief het flexibele `extra_info` JSON-veld) en [`backend/main.py`](../../backend/main.py).
  - **Validatie:** Backend start correct en exposeert alle gedefinieerde REST API endpoints.

- **Mijlpaal 3: Backend Bugfix & Geautomatiseerde Tests**
  - **Doel:** Oplossen van datamodel relatieproblemen en garanderen van backendstabiliteit.
  - **Prompt / Actie:** Herstel van `back_populates` relaties in [`backend/models.py`](../../backend/models.py) en toevoegen/uitvoeren van [`backend/tests/test_api.py`](../../backend/tests/test_api.py).
  - **Validatie:** 4/4 geslaagde `pytest` tests [`backend/tests/test_api.py`](../../backend/tests/test_api.py).

- **Mijlpaal 4: Frontend Initialisatie**
  - **Doel:** Bootstrap van het Angular frontend-project volgens moderne standaarden.
  - **Prompt / Actie:** Initialiseren van Angular in [`frontend/`](../../frontend/), vastleggen van moderne `angular.dev` standaarden in [`frontend/.clinerules`](../../frontend/.clinerules), en opzetten van [`frontend/src/app/services/api.service.ts`](../../frontend/src/app/services/api.service.ts).
  - **Validatie:** Projectstructuur voldoet aan de eisen en communiceert met de backend service.

- **Mijlpaal 5: Frontend Configuratie & Styling Fixes**
  - **Doel:** Oplossen van configuratie- en stylingproblemen in Angular en Tailwind v4.
  - **Prompt / Actie:** Oplossen van NG0908 via `provideZonelessChangeDetection` in [`frontend/src/app/app.config.ts`](../../frontend/src/app/app.config.ts), en instellen van PostCSS (`[@tailwindcss/postcss`](../../frontend/.postcssrc.json)) in [`frontend/src/styles.css`](../../frontend/src/styles.css).
  - **Validatie:** Succesvolle productiebuild (`npm run build`).

- **Mijlpaal 6: Codex Overzicht**
  - **Doel:** Implementeren van het hoofdscherm om ontdekte diersoorten weer te geven.
  - **Prompt / Actie:** Bouwen van [`frontend/src/app/pages/codex/codex.component.ts`](../../frontend/src/app/pages/codex/codex.component.ts) met Signals, `@for`/`@if` control flow en responsieve dierkaarten.
  - **Validatie:** Visuele en functionele weergave van de codex met ontdekte en onbekende dieren.

- **Prompt 3.1: Upload Interface & State**
  - **Doel:** Aanmaken van de observatiepagina met uploadmogelijkheid.
  - **Prompt / Actie:** Aanmaken van [`frontend/src/app/pages/observe/observe.component.ts`](../../frontend/src/app/pages/observe/observe.component.ts) met drag-and-drop fotoselectie, live image preview, notitieveld en Signals. Toevoegen van route `/observe` en navigatielink.
  - **Validatie:** Succesvolle componentinitialisatie en unit tests.

- **Prompt 3.2: API & Mock-AI Integratie**
  - **Doel:** Koppelen van het uploadformulier aan de backend REST API en tonen van herkenningsresultaten.
  - **Prompt / Actie:** Uitbreiden van [`frontend/src/app/services/api.service.ts`](../../frontend/src/app/services/api.service.ts) met `createObservation()` en integratie in `observe.component.ts` inclusief resultaatkaart en confidence score.
  - **Validatie:** Volledige end-to-end werking met backend AI-mock en succesvolle API responsverwerking.

- **Prompt 3.3: Gamificatie & Badges**
  - **Doel:** Uitbreiden van de gamificatie-ervaring met een dedicated badges-overzicht.
  - **Prompt / Actie:** Aanmaken van [`frontend/src/app/pages/badges/badges.component.ts`](../../frontend/src/app/pages/badges/badges.component.ts), toevoegen van `getBadges()` in `api.service.ts`, en instellen van route `/badges` met headerlink.
  - **Validatie:** Correcte weergave van behaalde en vergrendelde badges met visuele indicators.

- **Prompt 3.4: Geautomatiseerde Frontend Verificatie**
  - **Doel:** Waarborgen van de frontendkwaliteit door middel van geautomatiseerde tests en builds.
  - **Prompt / Actie:** Uitbreiden van unit tests in [`frontend/src/app/services/api.service.spec.ts`](../../frontend/src/app/services/api.service.spec.ts) en [`frontend/src/app/pages/badges/badges.component.spec.ts`](../../frontend/src/app/pages/badges/badges.component.spec.ts), en uitvoeren van `npm run build`.
  - **Validatie:** Alle tests en productiebuild (`npm run build`) succesvol voltooid zonder fouten of waarschuwingen.

---

## Deel 2: Geplande Vervolgprompts (Roadmap)
*Momenteel zijn alle geplande kernfunctionaliteiten en sprints succesvol afgerond.*
