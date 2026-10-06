# SPEC.md — BioLoggr

## Wat is dit?
Een applicatie met een codex van dieren en een interactieve kaart. Foto's kunnen worden opgeladen die door een AI-model worden bestudeerd om het die op de foto te identificeren. Als het dier geïdentificeerd kan worden, wordt het vrijgespeeld in de codex en wordt op de interactieve kaart bijgehouden waar de waarneming plaatsvond. Er wordt met een incentive-systeem van badges gewerkt om gebruikers te motiveren. De app dient als logboek van waargenomen dieren.

## Doelgroep
Natuurliefhebbers, (natuur)fotografen en wandelaars.

## Kernfunctionaliteit
1. Foto's opladen en bewaren
2. Dieren identificeren
3. Locatie van waarnemingen ingeven of uit fotoinformatie halen en bewaren
4. Logboek/indexboek met dieren bijhouden
5. Interactieve kaart met pinpoints van waarnemingen tonen
6. Dierinformatie tonen
7. Zelfzaamheid van dieren bepalen
8. Badgesysteem bijhouden

## Tech stack (voorkeur, open voor discussie)
- Database: SQLite met ORM voor eventuele overbrenging naar Supabase in latere fase (PostgreSQL met eventueel PostGIS-extensie)
- Frontend: Angular
- Backend: Python/FastAPI en in latere fase eventueel Render of Fly.io
- Foto-opslag: lokaal bewaren en in latere fase Cloudflare R2 gebruiken
- AI / model: BioCLIP (pytorch) en in latere fase eigen VPS of cloud container

## Wat ik nog niet weet
- Welke API gebruik ik best om diersoorten in te laden?
- Hoe comprimeer ik best afbeeldingen en waar worden deze bewaard?
- Hoe worden de dieren in het logboek verdeeld - per klasse, per zeldzaamheid...?
- Wat zal de layout worden van de applicatie?

## Niet in scope (v1)
- Mobiel gebruik op gsm
- Accountsysteem
- Wereldwijd gebruik
- Keuze om ook zoodieren waar te nemen bij het opladen van foto's

## Kwaliteitseisen
- Elk elk element uit de code wordt na het bouwen getest.