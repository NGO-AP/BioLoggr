import { Component, signal, inject, afterEveryRender, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, Animal, Observation, BadgeSummary, Suggestion } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { ObserveResetService } from '../../services/observe-reset.service';
import * as L from 'leaflet';
import { gps as parseGps } from 'exifr';

interface ObservationResult {
  observation: Observation;
  animal: Animal;
  newly_unlocked_badges: BadgeSummary[];
}

type LocationSource = 'exif' | 'browser' | 'default' | 'manual';

// SVG-pin als divIcon — geen externe afbeeldingen nodig, werkt altijd in Angular/esbuild
const PIN_ICON = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 26 16 26S32 26 32 16C32 7.163 24.837 0 16 0z"
      fill="#059669" stroke="#fff" stroke-width="2"/>
    <circle cx="16" cy="16" r="6" fill="#fff"/>
  </svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -42],
});

const DEFAULT_LAT = 51.2;
const DEFAULT_LON = 4.4;

@Component({
  selector: 'app-observe',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">Observatie Toevoegen</h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">Upload een foto van een dier in de natuur om deze te laten identificeren door de AI.</p>

      @if (errorMessage()) {
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm">
          {{ errorMessage() }}
        </div>
      }

      @if (result(); as res) {
        <!-- Resultaatkaart na succesvolle analyse -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-800/50 p-6 space-y-6">
          <div class="flex items-center space-x-3 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
            <span class="text-3xl">🎉</span>
            <div>
              <h2 class="text-lg font-bold text-emerald-900 dark:text-emerald-400">Succesvol geïdentificeerd!</h2>
              <p class="text-xs text-emerald-700 dark:text-emerald-500">Betrouwbaarheidsscore: <strong>{{ (res.observation.confidence * 100).toFixed(1) }}% match</strong></p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            @if (previewUrl()) {
              <img [src]="previewUrl()" alt="Geüploade foto" class="rounded-xl shadow object-cover h-48 w-full" />
            }
            <div class="space-y-3">
              <div>
                <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600">{{ res.animal.rarity }}</span>
                <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ res.animal.dutch_name }}</h3>
                <p class="text-sm italic text-gray-500 dark:text-gray-400">{{ res.animal.scientific_name }}</p>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ res.animal.description }}</p>
            </div>
          </div>

          @if (res.newly_unlocked_badges && res.newly_unlocked_badges.length > 0) {
            <div class="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
              <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>🏆</span> Nieuw ontgrendelde badges!
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                @for (badge of res.newly_unlocked_badges; track badge.id) {
                  <div
                    class="flex items-center space-x-3 p-3 rounded-xl border"
                    [class]="badge.is_challenge
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'"
                  >
                    <span class="text-2xl">{{ badge.icon }}</span>
                    <div>
                      @if (badge.is_challenge) {
                        <span class="text-xs font-bold text-amber-600 dark:text-amber-400">🔥 Uitdaging!</span>
                      }
                      <p class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ badge.title }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ badge.description }}</p>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <div class="flex gap-4 pt-2">
            <button
              type="button"
              (click)="resetForm()"
              class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow transition-colors cursor-pointer"
            >
              Nog een observatie doen
            </button>
            <button
              type="button"
              (click)="openInCodex()"
              class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer"
            >
              Bekijk in Codex
            </button>
          </div>
        </div>

      } @else {
        <!-- Upload Formulier -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">

          <!-- Foto upload zone -->
          <div
            class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors cursor-pointer relative"
            (dragover)="$event.preventDefault()"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            @if (previewUrl()) {
              <div class="space-y-4">
                <img [src]="previewUrl()" alt="Voorbeeld" class="max-h-64 mx-auto rounded-lg shadow object-contain" />
                <p class="text-sm text-gray-500 dark:text-gray-400">Klik of sleep een andere foto om te wijzigen</p>
              </div>
            } @else {
              <div class="space-y-3">
                <div class="text-4xl">📸</div>
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sleep hier je foto naartoe of <span class="text-emerald-600 underline">blader door bestanden</span>
                </div>
                <p class="text-xs text-gray-400 dark:text-gray-500">PNG, JPG of WEBP</p>
              </div>
            }
            <input
              #fileInput
              type="file"
              accept="image/*"
              class="hidden"
              (change)="onFileSelected($event)"
            />
          </div>

          <!-- ── AI Suggesties ───────────────────────────────────────────── -->
          @if (selectedFile()) {
            <div class="space-y-2">
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300">🧠 AI Soortidentificatie</label>

              @if (isIdentifying()) {
                <div class="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl text-sm text-blue-700 dark:text-blue-400">
                  <svg class="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Foto wordt geanalyseerd door BioCLIP…
                </div>
              } @else if (aiStatus() === 'loading') {
                <div class="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-sm text-amber-800 dark:text-amber-400">
                  ⏳ AI-model wordt nog geladen op de achtergrond…
                </div>
              } @else if (aiStatus() === 'error') {
                <div class="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400">
                  ℹ️ AI-identificatie niet beschikbaar.
                </div>
              } @else if (suggestions().length > 0) {
                <div class="space-y-2">
                  @for (s of suggestions(); track s.animal_id; let i = $index) {
                    <button
                      type="button"
                      (click)="selectSuggestion(s)"
                      class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left"
                      [class]="selectedSuggestion()?.animal_id === s.animal_id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500'"
                    >
                      <span class="text-lg font-black w-5 shrink-0"
                        [class.text-emerald-500]="selectedSuggestion()?.animal_id === s.animal_id"
                        [class.text-gray-300]="selectedSuggestion()?.animal_id !== s.animal_id"
                      >{{ i + 1 }}</span>
                      <div class="flex-1 min-w-0">
                        <span class="font-semibold text-sm text-gray-900 dark:text-gray-100">{{ s.dutch_name }}</span>
                        <span class="block text-xs italic text-gray-400 dark:text-gray-500 truncate">{{ s.scientific_name }}</span>
                      </div>
                      <!-- Betrouwbaarheids-badge -->
                      <div class="shrink-0 text-right">
                        <span class="text-sm font-bold tabular-nums"
                          [class.text-emerald-600]="s.confidence >= 0.5"
                          [class.dark:text-emerald-400]="s.confidence >= 0.5"
                          [class.text-amber-500]="s.confidence >= 0.25 && s.confidence < 0.5"
                          [class.text-gray-400]="s.confidence < 0.25"
                        >{{ (s.confidence * 100).toFixed(1) }}%</span>
                      </div>
                    </button>
                  }

                  @if (selectedSuggestion()) {
                    <p class="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1">
                      <span>✓</span>
                      <strong>{{ selectedSuggestion()!.dutch_name }}</strong> geselecteerd als soort.
                      <button type="button" (click)="clearSuggestion()"
                        class="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline cursor-pointer"
                      >Wissen</button>
                    </p>
                  } @else {
                    <p class="text-xs text-gray-400 dark:text-gray-500 pt-1">Klik op een suggestie om de soort te bevestigen, of laat dit leeg voor automatische keuze (suggestie 1).</p>
                  }
                </div>
              }
            </div>
          }

          <!-- Type waarneming (Wild vs. Dierentuin) -->
          <div class="space-y-2">
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300">Type waarneming</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                (click)="isWild.set(true)"
                class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer"
                [class]="isWild()
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
              >
                <span class="text-2xl">🌿</span>
                <span>In het wild</span>
              </button>
              <button
                type="button"
                (click)="isWild.set(false)"
                class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer"
                [class]="!isWild()
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
              >
                <span class="text-2xl">🏛️</span>
                <span>Dierentuin/Opvang</span>
              </button>
            </div>
          </div>

          <!-- Locatiesectie -->
          <div class="space-y-3">
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300">📍 Locatie van waarneming</label>

            <!-- Plaatsnaam zoeken -->
            <div class="relative">
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <input
                    type="text"
                    [value]="placeQuery()"
                    (input)="onPlaceQueryChange($event)"
                    (keydown.enter)="searchPlace()"
                    placeholder="Zoek een plaats, adres of regio..."
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none pr-8"
                  />
                  @if (placeQuery()) {
                    <button type="button" (click)="clearPlaceSearch()" class="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-xs">✕</button>
                  }
                </div>
                <button
                  type="button"
                  (click)="searchPlace()"
                  [disabled]="isSearching() || !placeQuery().trim()"
                  class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  @if (isSearching()) {
                    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  } @else {
                    🔍
                  }
                </button>
              </div>

              <!-- Zoekresultaten dropdown -->
              @if (placeResults().length > 0) {
                <div class="absolute z-[1000] top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                  @for (result of placeResults(); track result.place_id) {
                    <button
                      type="button"
                      (click)="selectPlace(result)"
                      class="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors cursor-pointer"
                    >
                      <span class="font-medium text-gray-900 dark:text-gray-100">{{ result.display_name.split(',')[0] }}</span>
                      <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">{{ result.display_name }}</span>
                    </button>
                  }
                </div>
              }
              @if (placeError()) {
                <p class="text-xs text-red-500 mt-1">{{ placeError() }}</p>
              }
            </div>

            @switch (locationSource()) {
              @case ('exif') {
                <div class="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm text-emerald-800 dark:text-emerald-400">
                  <span>✅</span> Locatie automatisch overgenomen uit foto
                </div>
              }
              @case ('browser') {
                <div class="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg text-sm text-blue-800 dark:text-blue-400">
                  <span>📡</span> Locatie bepaald via browser-GPS
                </div>
              }
              @case ('manual') {
                <div class="flex items-center justify-between px-3 py-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 rounded-lg text-sm text-violet-800 dark:text-violet-400">
                  <span class="flex items-center gap-2"><span>✏️</span> Handmatig gekozen locatie</span>
                  @if (exifLat() !== null) {
                    <button
                      type="button"
                      (click)="resetToExifLocation()"
                      class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 underline cursor-pointer ml-3 shrink-0"
                    >↩ Terug naar foto-locatie</button>
                  }
                </div>
              }
              @default {
                <div class="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg text-sm text-amber-800 dark:text-amber-400">
                  <span>ℹ️</span> Klik op de kaart of sleep de speld om de locatie te kiezen
                </div>
              }
            }

            <div id="observe-map" class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style="height: 280px;"></div>

            <p class="text-xs text-gray-400 dark:text-gray-500 text-right tabular-nums">
              {{ lat() | number:'1.4-4' }}° N, {{ lon() | number:'1.4-4' }}° O
            </p>
          </div>

          <!-- Notities -->
          <div class="space-y-2">
            <label for="notes" class="block text-sm font-semibold text-gray-700 dark:text-gray-300">Notities / Waarnemingdetails</label>
            <textarea
              id="notes"
              rows="3"
              [value]="notes()"
              (input)="onNotesChange($event)"
              placeholder="Bijv. Gezien bij de vijver in het bos, rond 14:00 uur..."
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            ></textarea>
          </div>

          <!-- Submit -->
          <button
            type="button"
            [disabled]="!selectedFile() || isUploading()"
            (click)="onSubmit()"
            class="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-xl shadow transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            @if (isUploading()) {
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>AI Analyseert foto...</span>
            } @else {
              <span>Observatie Versturen & Analyseren</span>
            }
          </button>
        </div>
      }
    </div>
  `
})
export class ObserveComponent implements OnDestroy {
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private mapInitialized = false;

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly notes = signal<string>('');
  protected readonly isUploading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<ObservationResult | null>(null);
  protected readonly isWild = signal<boolean>(true);

  // AI-identificatie
  protected readonly suggestions     = signal<Suggestion[]>([]);
  protected readonly selectedSuggestion = signal<Suggestion | null>(null);
  protected readonly isIdentifying   = signal<boolean>(false);
  protected readonly aiStatus        = signal<'idle' | 'loading' | 'error'>('idle');

  protected readonly lat = signal<number>(DEFAULT_LAT);
  protected readonly lon = signal<number>(DEFAULT_LON);
  protected readonly locationSource = signal<LocationSource>('default');
  protected readonly exifLat = signal<number | null>(null);
  protected readonly exifLon = signal<number | null>(null);

  // Plaatsnaam zoeken
  protected readonly placeQuery = signal<string>('');
  protected readonly placeResults = signal<any[]>([]);
  protected readonly placeError = signal<string | null>(null);
  protected readonly isSearching = signal<boolean>(false);

  constructor() {
    inject(ObserveResetService)
      .onResetRequested$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.resetForm());

    afterEveryRender(() => {
      if (this.result()) {
        if (this.mapInitialized) {
          this.map?.remove();
          this.map = null;
          this.marker = null;
          this.mapInitialized = false;
        }
      } else {
        if (!this.mapInitialized) {
          this.initMap();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // ── Kaart ───────────────────────────────────────────────────────────────────

  private initMap(): void {
    const container = document.getElementById('observe-map');
    if (!container) return;

    this.mapInitialized = true;
    this.map = L.map(container).setView([this.lat(), this.lon()], 10);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.marker = L.marker([this.lat(), this.lon()], { draggable: true, icon: PIN_ICON }).addTo(this.map);

    this.marker.on('dragend', () => {
      const pos = this.marker!.getLatLng();
      this.lat.set(pos.lat);
      this.lon.set(pos.lng);
      this.locationSource.set('manual');
    });

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.lat.set(lat);
      this.lon.set(lng);
      this.marker!.setLatLng([lat, lng]);
      this.locationSource.set('manual');
    });
  }

  private updateMapLocation(lat: number, lon: number): void {
    if (this.map && this.marker) {
      this.map.setView([lat, lon], 13);
      this.marker.setLatLng([lat, lon]);
    }
  }

  // ── Event handlers ───────────────────────────────────────────────────────────

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      void this.processFile(input.files[0]);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files?.[0]) {
      void this.processFile(event.dataTransfer.files[0]);
    }
  }

  protected onNotesChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.notes.set(textarea.value);
  }

  protected selectSuggestion(s: Suggestion): void {
    this.selectedSuggestion.set(
      this.selectedSuggestion()?.animal_id === s.animal_id ? null : s
    );
  }

  protected clearSuggestion(): void {
    this.selectedSuggestion.set(null);
  }

  protected onSubmit(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.errorMessage.set(null);

    const formData = new FormData();
    formData.append('file', file);
    if (this.notes()) formData.append('notes', this.notes());

    // Gebruik geselecteerde suggestie (of suggestie 1 als AI klaar was)
    const confirmed = this.selectedSuggestion();
    const autoTop   = !confirmed && this.suggestions().length > 0 ? this.suggestions()[0] : null;
    const chosen    = confirmed ?? autoTop;
    const animalId  = chosen?.animal_id ?? null;
    // Stuur de exacte score mee die de gebruiker zag — backend herberekent NIET
    const matchScore = chosen?.confidence ?? null;

    this.apiService.createObservation(formData, this.lat(), this.lon(), this.isWild(), animalId, matchScore).subscribe({
      next: (res: any) => {
        this.isUploading.set(false);
        this.result.set(res);
        // Toon toast voor elk vrijgespeeld badge
        if (res.newly_unlocked_badges?.length) {
          for (const badge of res.newly_unlocked_badges) {
            this.toastService.showBadgeToast(badge);
          }
        }
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set('Er is een fout opgetreden bij het analyseren van de observatie. Probeer het opnieuw.');
        console.error(err);
      }
    });
  }

  protected openInCodex(): void {
    const res = this.result();
    if (!res?.animal?.id) return;
    this.router.navigate(['/'], { queryParams: { speciesId: res.animal.id } });
  }

  protected resetForm(): void {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.notes.set('');
    this.result.set(null);
    this.errorMessage.set(null);
    this.isWild.set(true);
    this.lat.set(DEFAULT_LAT);
    this.lon.set(DEFAULT_LON);
    this.locationSource.set('default');
    this.exifLat.set(null);
    this.exifLon.set(null);
    this.placeQuery.set('');
    this.placeResults.set([]);
    this.placeError.set(null);
    this.suggestions.set([]);
    this.selectedSuggestion.set(null);
    this.isIdentifying.set(false);
    this.aiStatus.set('idle');
  }

  // ── Plaatsnaam zoeken ────────────────────────────────────────────────────────

  protected onPlaceQueryChange(event: Event): void {
    this.placeQuery.set((event.target as HTMLInputElement).value);
    this.placeResults.set([]);
    this.placeError.set(null);
  }

  protected async searchPlace(): Promise<void> {
    const q = this.placeQuery().trim();
    if (!q) return;

    this.isSearching.set(true);
    this.placeResults.set([]);
    this.placeError.set(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=nl`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'nl' } });
      const data = await res.json();
      if (data.length === 0) {
        this.placeError.set('Geen resultaten gevonden. Probeer een andere zoekterm.');
      } else {
        this.placeResults.set(data);
      }
    } catch {
      this.placeError.set('Kon niet zoeken. Controleer je internetverbinding.');
    } finally {
      this.isSearching.set(false);
    }
  }

  protected selectPlace(result: any): void {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    this.lat.set(lat);
    this.lon.set(lon);
    this.locationSource.set('manual');
    this.updateMapLocation(lat, lon);
    this.placeResults.set([]);
    this.placeQuery.set(result.display_name.split(',')[0]);
  }

  protected clearPlaceSearch(): void {
    this.placeQuery.set('');
    this.placeResults.set([]);
    this.placeError.set(null);
  }

  protected resetToExifLocation(): void {
    const lat = this.exifLat();
    const lon = this.exifLon();
    if (lat !== null && lon !== null) {
      this.lat.set(lat);
      this.lon.set(lon);
      this.locationSource.set('exif');
      this.updateMapLocation(lat, lon);
    }
  }

  // ── File processing ──────────────────────────────────────────────────────────

  private async processFile(file: File): Promise<void> {
    this.selectedFile.set(file);
    this.suggestions.set([]);
    this.selectedSuggestion.set(null);
    this.aiStatus.set('idle');

    const reader = new FileReader();
    reader.onload = (e) => this.previewUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);

    // Start AI-identificatie parallel aan EXIF/geolocation
    this.isIdentifying.set(true);
    this.apiService.identifyImage(file).subscribe({
      next: (res) => {
        this.isIdentifying.set(false);
        if (res.status === 'ready' && res.suggestions?.length) {
          this.suggestions.set(res.suggestions);
          this.aiStatus.set('idle');
        } else if (res.status === 'loading') {
          this.aiStatus.set('loading');
        } else {
          this.aiStatus.set('error');
        }
      },
      error: () => {
        this.isIdentifying.set(false);
        this.aiStatus.set('error');
      },
    });

    try {
      const gpsData = await parseGps(file);
      if (gpsData?.latitude != null && gpsData?.longitude != null) {
        this.lat.set(gpsData.latitude);
        this.lon.set(gpsData.longitude);
        this.exifLat.set(gpsData.latitude);
        this.exifLon.set(gpsData.longitude);
        this.locationSource.set('exif');
        this.updateMapLocation(gpsData.latitude, gpsData.longitude);
        return;
      }
    } catch {
      // Geen EXIF GPS — ga verder
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.lat.set(pos.coords.latitude);
          this.lon.set(pos.coords.longitude);
          this.locationSource.set('browser');
          this.updateMapLocation(pos.coords.latitude, pos.coords.longitude);
        },
        () => { this.locationSource.set('default'); },
        { timeout: 5000 }
      );
    }
  }
}
