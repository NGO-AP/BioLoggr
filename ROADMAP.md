# 🗺️ BioLoggr — Roadmap

> Gestructureerde uitrolplanning per fase met concrete acceptatiecriteria en status-vinkjes.  
> Markeer een taak als voltooid door `[ ]` te vervangen door `[x]`.

---

## Fase 1 · Data-architectuur, Opslagoptimalisatie & CRUD

**Doel:** Solide datalaag — meerdere waarnemingen per soort, volledig beheer en geoptimaliseerde afbeeldingen.

### 1.1 Meerdere waarnemingen per soort

| Status | Acceptatiecriterium |
|--------|---------------------|
| [x] | `Animal` → `Observation` relatie is 1-N in SQLModel (`Relationship(back_populates=...)`) |
| [x] | `GET /api/codex` levert `latest_observation` terug (meest recente) |
| [ ] | `GET /api/codex/{id}` levert **alle** waarnemingen terug als gesorteerde lijst (`observations: list[ObservationOut]`) |
| [ ] | Detailmodal in de Codex toont een **tijdlijn/galerij** van alle eerdere waarnemingen: thumbnail, datum, locatie, match score |
| [ ] | Galerij is horizontaal scrollbaar op mobiel |

### 1.2 Waarnemingen bewerken en verwijderen

| Status | Acceptatiecriterium |
|--------|---------------------|
| [ ] | `DELETE /api/observations/{id}` verwijdert het DB-record én het bijbehorende bestand van schijf (`os.remove`) |
| [ ] | Als de verwijderde observatie de **laatste** voor een soort was, keert het dier terug naar status "Onontdekt" (geen `latest_observation`) — dit wordt afgedwongen door de bestaande codex-logica zonder extra veld |
| [ ] | `PATCH /api/observations/{id}` laat `notes` en `is_wild` aanpassen |
| [ ] | Detailmodal heeft ✏️ / 🗑️ knoppen bij elke waarneming-rij (alleen zichtbaar bij hover) |
| [ ] | Frontend vraagt bevestiging vóór definitief verwijderen (inline confirm, geen browser-dialoog) |

### 1.3 Intelligente afbeeldingscompressie (Backend)

| Status | Acceptatiecriterium |
|--------|---------------------|
| [ ] | Pillow (`Pillow>=10`) toegevoegd aan `requirements.txt` |
| [ ] | Upload-pijplijn in `POST /api/observations` herschaalt foto naar **max 1920×1080** (WebP, quality=82) voordat het naar schijf wordt geschreven |
| [ ] | Thumbnail (300×300, bijgesneden op midden) wordt opgeslagen als `{filename}_thumb.webp` |
| [ ] | `Observation.thumb_path` kolom toegevoegd; wordt gevuld bij elke upload (auto-migratie in `database.py`) |
| [ ] | Codexkaarten en tijdlijn gebruiken `thumb_path`; enkel de detailmodal laadt de volledige afbeelding |
| [ ] | Bestaande waarnemingen zonder thumbnail hebben graceful fallback op `image_path` |

---

## Fase 2 · Veldwerkbeleving & Gamification

**Doel:** Spelelementen die de gebruiker motiveren om vaker en diverser te gaan waarnemen.

### 2.1 Badge- en Beloningssysteem

| Status | Acceptatiecriterium |
|--------|---------------------|
| [x] | Basis badge-model en `GET /api/badges` endpoint aanwezig |
| [x] | "Eerste Waarneming" badge wordt automatisch ontgrendeld |
| [ ] | Badge-engine uitgebreid met triggers (worden gecontroleerd na elke nieuwe observatie): |
| [ ] | &nbsp;&nbsp;• **Nachtbraker** — waarneming gelogd tussen 22:00 en 05:00 |
| [ ] | &nbsp;&nbsp;• **Herpetoloog** — 3 unieke Reptielen & Amfibieën waargenomen |
| [ ] | &nbsp;&nbsp;• **Vogelspotter** — 10 unieke Vogels waargenomen |
| [ ] | &nbsp;&nbsp;• **In het wild** — 10 waarnemingen met `is_wild=True` |
| [ ] | &nbsp;&nbsp;• **Veelzijdig** — minstens 1 soort in elk van de 4 taxonomische klassen |
| [ ] | `POST /api/observations` retourneert een lijst van **alle** nieuw ontgrendelde badges |
| [ ] | Badges-pagina (`/badges`) toont: ontgrendelde badges (met datum), vergrendelde badges als grijze silhouetten met voortgangsbalk ("2 van 3 soorten") |
| [ ] | Route en navigatielink toegevoegd |

### 2.2 Statistieken & Levenslijst

| Status | Acceptatiecriterium |
|--------|---------------------|
| [ ] | `GET /api/stats` endpoint retourneert: totaal ontdekte soorten, % per klasse, zeldzaamheidsverdeling, totaal aantal waarnemingen |
| [ ] | Dashboard-component (`/stats` of onderdeel van home) toont: |
| [ ] | &nbsp;&nbsp;• Ringdiagram of voortgangsbalken per klasse (bijv. "Vogels: 47/350") |
| [ ] | &nbsp;&nbsp;• Zeldzaamheidsverdeling als horizontale balk |
| [ ] | &nbsp;&nbsp;• Kaart met heatmap of geclusterde pins van alle waarnemingen |
| [ ] | &nbsp;&nbsp;• Top-5 meest bezochte locaties (op basis van GPS-clustering, straal 1 km) |

---

## Fase 3 · Mobiel & Multi-device Synchronisatie

**Doel:** BioLoggr functioneert als een echte veld-app — ook zonder internet, op telefoon en tablet.

### 3.1 PWA & Offline-First

| Status | Acceptatiecriterium |
|--------|---------------------|
| [ ] | `@angular/service-worker` geïnstalleerd en geconfigureerd (`ngsw-config.json`) |
| [ ] | `manifest.webmanifest` aangemaakt met naam, iconen (192×192 en 512×512 px), `display: standalone`, themecolor groen |
| [ ] | Lighthouse PWA-audit scoort ≥ 90/100 |
| [ ] | "Toevoegen aan beginscherm" werkt op iOS Safari en Android Chrome |
| [ ] | Observaties die worden aangemaakt zonder internetverbinding worden opgeslagen in **IndexedDB** (via `@ngneat/offline` of eigen service) |
| [ ] | Bij herstel van verbinding worden gebufferde observaties automatisch gesynchroniseerd met de backend (conflict = oudste wint) |
| [ ] | UI toont een offline-indicator (banner of statusbadge) wanneer er geen netwerk beschikbaar is |

### 3.2 Self-hosting & Synchronisatiestrategie

| Status | Acceptatiecriterium |
|--------|---------------------|
| [ ] | `DEPLOYMENT.md` documenteert twee strategieën: (a) thuisserver + Tailscale VPN, (b) cloud VPS (Hetzner/DigitalOcean) |
| [ ] | `docker-compose.yml` aangemaakt: services `backend` (FastAPI + Uvicorn) en `frontend` (Nginx serving Angular dist) |
| [ ] | Migratiescript (`migrate_sqlite_to_postgres.py`) gedocumenteerd voor schaalslag naar PostgreSQL |
| [ ] | Omgevingsvariabelen gecentraliseerd in `.env.example` (DATABASE_URL, UPLOAD_DIR, ALLOWED_ORIGINS, SECRET_KEY) |
| [ ] | HTTPS via Let's Encrypt (Certbot) opgenomen in de Nginx-configuratie |

---

## Fase 4 · Senior Developer Review, Security Hardening & Productierijpheid

**Doel:** BioLoggr is veilig, snel en volledig getest — klaar voor echte gebruikers.

### 4.1 Grondige Security Audit

| Status | Acceptatiecriterium |
|--------|---------------------|
| [ ] | **Magic bytes verificatie**: upload-endpoint controleert de eerste bytes van elk bestand (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `52 49 46 46`) — bestanden met verkeerde signatuur worden geweigerd met HTTP 415 |
| [ ] | **Filename sanitization**: `werkzeug.utils.secure_filename` of eigen regex verwijdert path-traversal tekens (`../`, `%2F`, null bytes) |
| [ ] | **CORS** beperkt tot expliciete origins via omgevingsvariabele (`ALLOWED_ORIGINS`) — geen wildcard `*` in productie |
| [ ] | **Upload-grootte** beperkt tot 10 MB (FastAPI `UploadFile` + Nginx `client_max_body_size`) |
| [ ] | Geen geheimen (tokens, wachtwoorden) hardcoded in broncode — gecontroleerd met `git-secrets` of `truffleHog` |
| [ ] | Dependency-audit: `pip-audit` en `npm audit` geven geen kritieke CVE's |

### 4.2 Performance & Code Quality

| Status | Acceptatiecriterium |
|--------|---------------------|
| [ ] | BioCLIP-model draait in `eval()` mode met `torch.no_grad()` omheen alle inferentie-calls |
| [ ] | Optionele INT8-kwantisatie van het tekstencodermodel (reductie ~60% geheugengebruik) gedocumenteerd en vlag-geswitchbaar via omgevingsvariabele |
| [ ] | Angular-bundle geanalyseerd met `npx source-map-explorer` — geen onverwachte grote afhankelijkheden |
| [ ] | Ongebruikte CSS verwijderd (PurgeCSS/Tailwind safelist gecontroleerd) |
| [ ] | Dode Python code opgespoord met `vulture` |
| [ ] | **Backend testdekking ≥ 80%** (gemeten met `pytest-cov`): alle endpoints, edge-cases (ontbrekend dier, fout bestandstype, lege DB) |
| [ ] | **E2E-suite uitgebreid**: Playwright-tests voor tijdlijn, badge-ontgrendeling, offline-modus en zeldzaamheidsfilters |
| [ ] | CI-pipeline (GitHub Actions of Cursor Automations) voert bij elke push uit: `pytest`, `npm run build`, Playwright headless |

---

## Overzicht per fase

| Fase | Onderwerp | Taken | Voltooid |
|------|-----------|-------|----------|
| 1 | Data & CRUD | 16 | 3 |
| 2 | Gamification & Stats | 15 | 2 |
| 3 | PWA & Hosting | 12 | 0 |
| 4 | Security & Kwaliteit | 14 | 0 |
| **Totaal** | | **57** | **5** |

---

*Laatst bijgewerkt: 9 oktober 2026*
