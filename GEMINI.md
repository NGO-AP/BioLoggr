# GEMINI.md - Niels Gonnissen

## Wie ben ik
Student toegepaste informatica aan de AP Hogeschool (inleiding tot Python OOP, webprogramming met typescipt en database programming MySQL en SQLServer).
Ik volg aan de hogeschool het traject AI en heb enige notie van de mathematische fundamenten en ML principes achter AI modellen.
Een gezonde interesse en een zekere notie van fotografie met daarbij ook een interesse voor dieren in het algemeen.
Dit is mijn eerste project op zelfstandige basis en mijn eerste kennismaking met agentic coding.

## Taal
- Communicatie in het Nederlands, beknopt en to the point
- Code, comments en variabelen in het Engels
- Commit messages in het Nederlands (conventional commits)

## Stijl en verwachtingen
- Vraag bij twijfel. Maak geen aannames over architectuur, naamgeving of scope — stel de vraag
- Leg niet uit wat ik al weet. Ik ken Python, OOP, Git en de basisprincipes van software-architectuur ???
- Geef wél context bij keuzes die niet voor de hand liggen
- Wees direct. Geen disclaimers, geen "uiteraard!", geen onnodige inleidingen

## Tech stack (standaard)
- Python 3.11+
- Type hints op alle functies
- Pydantic voor validatie en datamodellen
- SQLite (met migratiemogelijkheid naar PostgreSQL)
- pytest voor tests
- Logging via het standaard logging-module, niet print()

## Conventies
- Dataclasses of Pydantic models voor entiteiten
- Google-stijl docstrings
- Geen globale state
- Geen hardcoded paden - configuratie via .env of config.yaml
- Requirements vastleggen in requirements.txt

## Regels
- NOOIT .env-bestanden uitlezen of tonen
- NOOIT bestaande tests verwijderen zonder dat ik erom vraag
- Altijd tests schrijven bij nieuwe functionaliteit
- Commit na elke afgeronde feature

## Referentiedocumenten
Lees het relevante document voordat je aan een onderdeel werkt:
- `SPEC.md` - Projectspecificatie en scope
- `.gemini/steering/tech.md` - Architectuurkeuzes (indien aanwezig)