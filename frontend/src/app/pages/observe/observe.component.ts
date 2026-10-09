import { Component, signal, inject, afterEveryRender, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Animal, Observation, Badge } from '../../services/api.service';
import * as L from 'leaflet';
import { gps as parseGps } from 'exifr';

interface ObservationResult {
  observation: Observation;
  animal: Animal;
  badges: Badge[];
}

type LocationSource = 'exif' | 'browser' | 'default' | 'manual';

// Fix Leaflet's default marker icons — broken in Angular/esbuild bundler builds
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DEFAULT_LAT = 51.2;
const DEFAULT_LON = 4.4;

@Component({
  selector: 'app-observe',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-black text-gray-900 mb-2">Observatie Toevoegen</h1>
      <p class="text-gray-600 mb-6">Upload een foto van een dier in de natuur om deze te laten identificeren door de AI.</p>

      @if (errorMessage()) {
        <div class="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {{ errorMessage() }}
        </div>
      }

      @if (result(); as res) {
        <!-- Resultaatkaart na succesvolle analyse -->
        <div class="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6 space-y-6">
          <div class="flex items-center space-x-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <span class="text-3xl">🎉</span>
            <div>
              <h2 class="text-lg font-bold text-emerald-900">Succesvol geïdentificeerd!</h2>
              <p class="text-xs text-emerald-700">Betrouwbaarheidsscore: <strong>{{ (res.observation.confidence * 100).toFixed(1) }}% match</strong></p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            @if (previewUrl()) {
              <img [src]="previewUrl()" alt="Geüploade foto" class="rounded-xl shadow object-cover h-48 w-full" />
            }
            <div class="space-y-3">
              <div>
                <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600">{{ res.animal.rarity }}</span>
                <h3 class="text-2xl font-bold text-gray-900">{{ res.animal.dutch_name }}</h3>
                <p class="text-sm italic text-gray-500">{{ res.animal.scientific_name }}</p>
              </div>
              <p class="text-sm text-gray-600">{{ res.animal.description }}</p>
            </div>
          </div>

          @if (res.badges && res.badges.length > 0) {
            <div class="border-t border-gray-100 pt-4 space-y-3">
              <h4 class="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>🏆</span> Nieuw ontgrendelde badges!
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                @for (badge of res.badges; track badge.id) {
                  <div class="flex items-center space-x-3 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                    <span class="text-2xl">{{ badge.icon }}</span>
                    <div>
                      <p class="text-sm font-bold text-amber-900">{{ badge.name }}</p>
                      <p class="text-xs text-amber-700">{{ badge.description }}</p>
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
            <a
              routerLink="/"
              class="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Bekijk in Codex
            </a>
          </div>
        </div>

      } @else {
        <!-- Upload Formulier -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">

          <!-- Foto upload zone -->
          <div
            class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer relative"
            (dragover)="$event.preventDefault()"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            @if (previewUrl()) {
              <div class="space-y-4">
                <img [src]="previewUrl()" alt="Voorbeeld" class="max-h-64 mx-auto rounded-lg shadow object-contain" />
                <p class="text-sm text-gray-500">Klik of sleep een andere foto om te wijzigen</p>
              </div>
            } @else {
              <div class="space-y-3">
                <div class="text-4xl">📸</div>
                <div class="text-sm font-medium text-gray-700">
                  Sleep hier je foto naartoe of <span class="text-emerald-600 underline">blader door bestanden</span>
                </div>
                <p class="text-xs text-gray-400">PNG, JPG of WEBP</p>
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

          <!-- Locatiesectie -->
          <div class="space-y-3">
            <label class="block text-sm font-semibold text-gray-700">📍 Locatie van waarneming</label>

            @switch (locationSource()) {
              @case ('exif') {
                <div class="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                  <span>✅</span> Locatie automatisch overgenomen uit foto
                </div>
              }
              @case ('browser') {
                <div class="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <span>📡</span> Locatie bepaald via browser-GPS
                </div>
              }
              @case ('manual') {
                <div class="flex items-center justify-between px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-800">
                  <span class="flex items-center gap-2"><span>✏️</span> Handmatig gekozen locatie</span>
                  @if (exifLat() !== null) {
                    <button
                      type="button"
                      (click)="resetToExifLocation()"
                      class="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline cursor-pointer ml-3 shrink-0"
                    >↩ Terug naar foto-locatie</button>
                  }
                </div>
              }
              @default {
                <div class="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <span>ℹ️</span> Klik op de kaart of sleep de speld om de locatie te kiezen
                </div>
              }
            }

            <div id="observe-map" class="rounded-xl overflow-hidden border border-gray-200" style="height: 280px;"></div>

            <p class="text-xs text-gray-400 text-right tabular-nums">
              {{ lat() | number:'1.4-4' }}° N, {{ lon() | number:'1.4-4' }}° O
            </p>
          </div>

          <!-- Notities -->
          <div class="space-y-2">
            <label for="notes" class="block text-sm font-semibold text-gray-700">Notities / Waarnemingdetails</label>
            <textarea
              id="notes"
              rows="3"
              [value]="notes()"
              (input)="onNotesChange($event)"
              placeholder="Bijv. Gezien bij de vijver in het bos, rond 14:00 uur..."
              class="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            ></textarea>
          </div>

          <!-- Submit -->
          <button
            type="button"
            [disabled]="!selectedFile() || isUploading()"
            (click)="onSubmit()"
            class="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-xl shadow transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

  // Leaflet instances — not reactive, managed manually
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private mapInitialized = false;

  // Form state
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly notes = signal<string>('');
  protected readonly isUploading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<ObservationResult | null>(null);

  // Location state
  protected readonly lat = signal<number>(DEFAULT_LAT);
  protected readonly lon = signal<number>(DEFAULT_LON);
  protected readonly locationSource = signal<LocationSource>('default');
  // Bewaar EXIF-coördinaten zodat de gebruiker na handmatig verslepen kan terugkeren
  protected readonly exifLat = signal<number | null>(null);
  protected readonly exifLon = signal<number | null>(null);

  constructor() {
    // afterEveryRender fires after every Angular render cycle — safe for zoneless CD
    afterEveryRender(() => {
      if (this.result()) {
        // Result is shown → form (and map div) removed from DOM → clean up Leaflet
        if (this.mapInitialized) {
          this.map?.remove();
          this.map = null;
          this.marker = null;
          this.mapInitialized = false;
        }
      } else {
        // Form is visible → initialize map once the div exists
        if (!this.mapInitialized) {
          this.initMap();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // ── Map ─────────────────────────────────────────────────────────────────────

  private initMap(): void {
    const container = document.getElementById('observe-map');
    if (!container) return;

    this.mapInitialized = true;

    this.map = L.map(container).setView([this.lat(), this.lon()], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.marker = L.marker([this.lat(), this.lon()], { draggable: true }).addTo(this.map);

    // Marker sleepen → locatie updaten
    this.marker.on('dragend', () => {
      const pos = this.marker!.getLatLng();
      this.lat.set(pos.lat);
      this.lon.set(pos.lng);
      this.locationSource.set('manual');
    });

    // Klikken op de kaart → speld verplaatsen
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

  protected onSubmit(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.errorMessage.set(null);

    const formData = new FormData();
    formData.append('file', file);
    if (this.notes()) {
      formData.append('notes', this.notes());
    }

    this.apiService.createObservation(formData, this.lat(), this.lon()).subscribe({
      next: (res: any) => {
        this.isUploading.set(false);
        this.result.set(res);
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set('Er is een fout opgetreden bij het analyseren van de observatie. Probeer het opnieuw.');
        console.error(err);
      }
    });
  }

  protected resetForm(): void {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.notes.set('');
    this.result.set(null);
    this.errorMessage.set(null);
    this.lat.set(DEFAULT_LAT);
    this.lon.set(DEFAULT_LON);
    this.locationSource.set('default');
    this.exifLat.set(null);
    this.exifLon.set(null);
    // mapInitialized is already false (cleared when result was set), so afterEveryRender will re-init
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

    // Afbeelding preview
    const reader = new FileReader();
    reader.onload = (e) => this.previewUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);

    // 1. Probeer GPS-coördinaten uit EXIF-metadata te lezen
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
      // Geen EXIF GPS aanwezig of parsing mislukt → ga verder
    }

    // 2. Fallback: browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.lat.set(pos.coords.latitude);
          this.lon.set(pos.coords.longitude);
          this.locationSource.set('browser');
          this.updateMapLocation(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Toestemming geweigerd of onbeschikbaar → standaardlocatie behouden
          this.locationSource.set('default');
        },
        { timeout: 5000 }
      );
    }
  }
}
