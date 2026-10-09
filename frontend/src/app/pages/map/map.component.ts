import { Component, OnInit, OnDestroy, signal, computed, inject, afterEveryRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService, Animal } from '../../services/api.service';
import * as L from 'leaflet';

const CATEGORIES = ['Alles', 'Zoogdieren', 'Vogels', 'Insecten', 'Reptielen & Amfibieën'] as const;
type Category = typeof CATEGORIES[number];

// Heel België in beeld: center + zoom
const BELGIUM_CENTER: L.LatLngTuple = [50.5039, 4.4699];
const BELGIUM_ZOOM = 8;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex flex-col" style="height: calc(100vh - 9rem)">

      <!-- Categorie-filterbalk (theme-aware) -->
      <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 flex-wrap transition-colors">
        <span class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1 shrink-0">Klasse</span>
        @for (cat of categories; track cat) {
          <button
            type="button"
            (click)="onCategoryChange(cat)"
            class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border"
            [class.bg-emerald-600]="selectedCategory() === cat"
            [class.dark:bg-emerald-500]="selectedCategory() === cat"
            [class.text-white]="selectedCategory() === cat"
            [class.border-emerald-600]="selectedCategory() === cat"
            [class.dark:border-emerald-500]="selectedCategory() === cat"
            [class.bg-white]="selectedCategory() !== cat"
            [class.dark:bg-transparent]="selectedCategory() !== cat"
            [class.text-gray-600]="selectedCategory() !== cat"
            [class.dark:text-gray-300]="selectedCategory() !== cat"
            [class.border-gray-200]="selectedCategory() !== cat"
            [class.dark:border-gray-600]="selectedCategory() !== cat"
          >{{ cat }}</button>
        }
        @if (!loading()) {
          <span class="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {{ filteredAnimals().length }} waarneming(en) zichtbaar
          </span>
        }
      </div>

      <!-- Kaart + overlay wrapper -->
      <div class="flex-1 relative">

        <!-- Laad-indicator -->
        @if (loading()) {
          <div class="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-[900]">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        }

        <!-- Leaflet kaart -->
        <div id="overview-map" class="absolute inset-0"></div>

        <!-- Lege-staat overlay -->
        @if (!loading() && filteredAnimals().length === 0) {
          <div class="absolute inset-0 flex items-center justify-center z-[900] pointer-events-none">
            <div class="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-2xl text-center space-y-3 pointer-events-auto max-w-sm mx-4">
              <div class="text-4xl">🗺️</div>
              <h3 class="font-bold text-gray-900 dark:text-gray-100 text-lg">Geen waarnemingen gevonden</h3>
              @if (selectedCategory() !== 'Alles') {
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Nog geen <strong>{{ selectedCategory() }}</strong>-waarnemingen met locatie geregistreerd.
                </p>
              } @else {
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Nog geen waarnemingen met locatie gevonden.<br>Voeg er een toe via Observaties!
                </p>
              }
              <a
                routerLink="/observe"
                class="inline-block bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >📸 Nieuwe Waarneming</a>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class MapComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);

  private map: L.Map | null = null;
  private markerLayer: L.LayerGroup | null = null;
  private mapInitialized = false;
  /** Coördinaten doorgegeven via ?lat=X&lng=Y (deeplink vanuit Codex) */
  private deepLinkCenter: L.LatLngTuple | null = null;

  protected readonly categories = CATEGORIES;
  protected readonly animals = signal<Animal[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedCategory = signal<Category>('Alles');

  protected readonly filteredAnimals = computed(() =>
    this.animals().filter(a =>
      a.latest_observation != null &&
      a.latest_observation.latitude != null &&
      a.latest_observation.longitude != null &&
      (this.selectedCategory() === 'Alles' || a.category === this.selectedCategory())
    )
  );

  constructor() {
    // afterEveryRender is the zoneless-safe hook to access the DOM after Angular renders
    afterEveryRender(() => {
      if (!this.mapInitialized) {
        this.initMap();
      }
    });
  }

  ngOnInit(): void {
    // Lees optionele deeplink-coördinaten uit de URL (?lat=X&lng=Y)
    const params = this.route.snapshot.queryParamMap;
    const lat = parseFloat(params.get('lat') ?? '');
    const lng = parseFloat(params.get('lng') ?? '');
    if (!isNaN(lat) && !isNaN(lng)) {
      this.deepLinkCenter = [lat, lng];
    }

    this.apiService.getCodex().subscribe({
      next: (animals) => {
        this.animals.set(animals);
        this.loading.set(false);
        this.updateMarkers();
      },
      error: () => this.loading.set(false)
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  /** Wordt aangeroepen vanuit de popup-knop (via window-scope event-delegation) */
  private onPopupDeleteClick = (e: Event): void => {
    const btn = (e.target as HTMLElement).closest('[data-del-obs]') as HTMLElement | null;
    if (!btn) return;
    const obsId = parseInt(btn.dataset['delObs'] ?? '', 10);
    const animalId = parseInt(btn.dataset['animalId'] ?? '', 10);
    if (isNaN(obsId) || isNaN(animalId)) return;
    if (!confirm('Weet je zeker dat je deze waarneming wilt verwijderen?')) return;
    this.apiService.deleteObservation(obsId).subscribe({
      next: () => {
        // Verwijder het dier uit de lokale lijst (geen waarnemingen meer met locatie)
        this.animals.update(list => list.filter(a => a.id !== animalId));
        this.updateMarkers();
        this.map?.closePopup();
      },
      error: () => alert('Verwijderen mislukt. Probeer opnieuw.'),
    });
  };

  protected onCategoryChange(cat: Category): void {
    this.selectedCategory.set(cat);
    this.updateMarkers();
  }

  // ── Kaart initialisatie ────────────────────────────────────────────────────

  private initMap(): void {
    const container = document.getElementById('overview-map');
    if (!container) return;

    this.mapInitialized = true;

    // Gebruik deeplink-coördinaten als die aanwezig zijn, anders heel België
    const initialView = this.deepLinkCenter ?? BELGIUM_CENTER;
    const initialZoom = this.deepLinkCenter ? 13 : BELGIUM_ZOOM;
    this.map = L.map(container).setView(initialView, initialZoom);

    // Esri World Light Gray Canvas — toont alleen landsgrenzen, stadsnamen en
    // landnamen; geen wegen of zeestroken. CSS-filter in styles.css maakt het donker.
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16,
      }
    ).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);

    // Event-delegation voor de verwijderknop in popups
    this.map.getContainer().addEventListener('click', this.onPopupDeleteClick);

    // Data kan al geladen zijn vóór de kaart geïnitialiseerd was
    if (!this.loading()) {
      this.updateMarkers();
    }
  }

  /** Smaragdgroene glowing dot-marker die afsteekt tegen de donkere achtergrond */
  private createMarkerIcon(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:14px;height:14px;
        background:#10b981;
        border:2px solid rgba(255,255,255,0.85);
        border-radius:50%;
        box-shadow:0 0 0 3px rgba(16,185,129,0.3), 0 0 12px rgba(16,185,129,0.6);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -12],
    });
  }

  // ── Markers beheren ────────────────────────────────────────────────────────

  private updateMarkers(): void {
    if (!this.map || !this.markerLayer) return;

    this.markerLayer.clearLayers();
    const animals = this.filteredAnimals();

    if (animals.length === 0) return;

    for (const animal of animals) {
      const obs = animal.latest_observation!;
      const lat = obs.latitude as number;
      const lon = obs.longitude as number;

      const marker = L.marker([lat, lon], { icon: this.createMarkerIcon() });
      marker.bindPopup(this.buildPopup(animal), { maxWidth: 220, className: 'biologgr-popup' });
      this.markerLayer.addLayer(marker);
    }
    // Geen fitBounds — België-overzicht blijft altijd gefixeerd
  }

  // ── Popup HTML bouwen ──────────────────────────────────────────────────────

  private buildPopup(animal: Animal): string {
    const obs = animal.latest_observation!;
    const date = new Date(obs.timestamp).toLocaleDateString('nl-BE', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const imgUrl = `http://localhost:8000${obs.image_path}`;
    // Escape om XSS te vermijden
    const name = this.esc(animal.dutch_name);
    const sci  = this.esc(animal.scientific_name);

    const obsId = obs.id;
    const animalId = animal.id;

    return `
      <div style="width:210px;font-family:system-ui,sans-serif;background:#111827">
        <img src="${imgUrl}" alt="${name}"
          style="width:100%;height:115px;object-fit:cover;display:block">
        <div style="padding:10px 12px 12px;background:#111827">
          <div style="font-weight:700;font-size:14px;color:#f9fafb;line-height:1.3">${name}</div>
          <div style="font-style:italic;font-size:11px;color:#6b7280;margin:2px 0 5px">${sci}</div>
          <div style="font-size:11px;color:#4b5563;margin-bottom:10px">📅 ${date}</div>
          <div style="display:flex;gap:6px">
            <a href="/?open=${animalId}"
              style="flex:1;text-align:center;background:#10b981;color:#fff;
                     font-size:12px;font-weight:600;padding:5px 0;border-radius:6px;
                     text-decoration:none">
              Codex →
            </a>
            <button
              data-del-obs="${obsId}"
              data-animal-id="${animalId}"
              style="flex:0 0 auto;background:#ef4444;border:none;color:#fff;
                     font-size:12px;font-weight:600;padding:5px 10px;border-radius:6px;cursor:pointer">
              🗑️
            </button>
          </div>
        </div>
      </div>`;
  }

  private esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
