import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ApiService, Animal, Observation } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-codex',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Dieren Codex</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">Ontdek alle waargenomen dieren, bekijk hun biologische fiche en ontgrendel de natuur.</p>
        </div>
        <!-- Zoekbalk -->
        <div class="relative w-full md:w-72">
          <input 
            type="text" 
            [value]="searchQuery()"
            (input)="onSearchChange($event)"
            placeholder="Zoek dier op naam..."
            class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm pl-10"
          />
          <span class="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
        </div>
      </header>

      @if (loading()) {
        <div class="flex justify-center items-center py-24">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-8">
          <!-- Linker Zijbalk (Filters) — sticky zodat filters altijd zichtbaar zijn -->
          <aside class="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pb-2">

            <!-- Herkomst filter -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
              <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">Herkomst</h3>
              <div class="flex flex-row flex-wrap gap-2 justify-center">
                @for (origin of origins; track origin.id) {
                  <button
                    type="button"
                    (click)="selectedOrigin.set(origin.id)"
                    [title]="origin.title"
                    class="min-h-[4.5rem] px-2 py-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border transition-all cursor-pointer shrink-0 text-slate-200 font-medium"
                    [class.bg-emerald-900/30]="selectedOrigin() === origin.id"
                    [class.border-emerald-500]="selectedOrigin() === origin.id"
                    [class.border-slate-600]="selectedOrigin() !== origin.id"
                    [class.bg-slate-800/40]="selectedOrigin() !== origin.id"
                    [class.hover:border-slate-500]="selectedOrigin() !== origin.id"
                  >
                    <span class="text-lg leading-none">{{ origin.emoji }}</span>
                    <span class="bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-md tabular-nums">{{ originCounts()[origin.id] }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Taxonomische klasse filter -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
              <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">Taxonomische Klasse</h3>
              <div class="flex flex-row flex-nowrap gap-1 justify-center">
                @for (cat of categories; track cat) {
                  <button
                    type="button"
                    (click)="selectedCategory.set(cat)"
                    [title]="cat === 'Alle klassen' ? 'Alle klassen' : cat"
                    class="min-h-[4.5rem] px-1.5 py-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border transition-all cursor-pointer shrink-0 text-slate-200 font-medium"
                    [class.bg-emerald-900/30]="selectedCategory() === cat"
                    [class.border-emerald-500]="selectedCategory() === cat"
                    [class.border-slate-600]="selectedCategory() !== cat"
                    [class.bg-slate-800/40]="selectedCategory() !== cat"
                    [class.hover:border-slate-500]="selectedCategory() !== cat"
                  >
                    @if (cat === 'Alle klassen') {
                      <span class="text-white text-sm font-medium leading-none">Alle</span>
                    } @else if (cat === 'Zoogdieren') {
                      <span class="text-[22px] leading-none">🦊</span>
                    } @else if (cat === 'Vogels') {
                      <span class="text-[22px] leading-none">🦅</span>
                    } @else if (cat === 'Insecten') {
                      <span class="text-[22px] leading-none">🦋</span>
                    } @else if (cat === 'Reptielen & Amfibieën') {
                      <span class="text-[22px] leading-none">🦎</span>
                    }
                    <span class="bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-md tabular-nums">{{ categoryCounts()[cat] ?? 0 }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Status filter -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm space-y-1">
              <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 pb-1">Ontdekkingsstatus</h3>
              @for (status of statuses; track status.id) {
                <button
                  type="button"
                  (click)="selectedStatus.set(status.id)"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer w-full text-slate-200"
                  [class.bg-emerald-900/30]="selectedStatus() === status.id"
                  [class.border]="selectedStatus() === status.id"
                  [class.border-emerald-500]="selectedStatus() === status.id"
                  [class.text-white]="selectedStatus() === status.id"
                  [class.hover:bg-slate-700/40]="selectedStatus() !== status.id"
                >
                  <span>{{ status.label }}</span>
                  <span class="bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-md tabular-nums"
                    [class.bg-emerald-600]="selectedStatus() === status.id"
                    [class.text-white]="selectedStatus() === status.id"
                  >{{ getStatusCount(status.id) }}</span>
                </button>
              }
            </div>

            <!-- Zeldzaamheid filter -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm space-y-1">
              <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 pb-1">Zeldzaamheid</h3>
              @for (r of rarities; track r.id) {
                <button
                  type="button"
                  (click)="selectedRarity.set(r.id)"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer w-full text-slate-200"
                  [class.bg-emerald-900/30]="selectedRarity() === r.id"
                  [class.border]="selectedRarity() === r.id"
                  [class.border-emerald-500]="selectedRarity() === r.id"
                  [class.text-white]="selectedRarity() === r.id"
                  [class.hover:bg-slate-700/40]="selectedRarity() !== r.id"
                >
                  <span>{{ r.label }}</span>
                  <span class="bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-md tabular-nums"
                    [class.bg-emerald-600]="selectedRarity() === r.id"
                    [class.text-white]="selectedRarity() === r.id"
                  >{{ getRarityCount(r.id) }}</span>
                </button>
              }
            </div>
          </aside>

          <!-- Rechter Overzicht (Dierkaarten) -->
          <div>
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              @for (animal of filteredAnimals(); track animal.id) {
                <div 
                  (click)="openDetail(animal)"
                  class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 flex flex-col cursor-pointer group"
                >
                  <div class="h-48 bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                    @if (animal.latest_observation && !brokenImages().has(animal.id)) {
                      <img
                        [src]="'http://localhost:8000' + animal.latest_observation.image_path"
                        [alt]="animal.dutch_name"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        (error)="markImageBroken(animal.id)"
                      >
                    } @else if (animal.image_url && !brokenImages().has(animal.id)) {
                      <img
                        [src]="'http://localhost:8000' + animal.image_url"
                        [alt]="animal.dutch_name"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 brightness-0 opacity-30"
                        (error)="markImageBroken(animal.id)"
                      >
                    } @else {
                      <!-- Geen afbeelding: categorie-emoji als placeholder -->
                      <div class="w-full h-full flex flex-col items-center justify-center gap-2">
                        <span class="text-5xl opacity-25">{{ categoryIcon(animal.category) }}</span>
                        <span class="text-xs text-gray-400 dark:text-gray-500">{{ animal.category }}</span>
                      </div>
                    }

                    <!-- Zeldzaamheidstag rechtsboven -->
                    <div class="absolute top-3 right-3">
                      <span class="px-2.5 py-1 text-xs font-semibold rounded-full backdrop-blur shadow-sm"
                        [class]="animal.rarity === 'Bedreigd'      ? 'bg-red-100/90 text-red-800'    :
                                 animal.rarity === 'Zeldzaam'      ? 'bg-orange-100/90 text-orange-800' :
                                 animal.rarity === 'Vrij algemeen' ? 'bg-yellow-100/90 text-yellow-800' :
                                 animal.rarity === 'Algemeen'      ? 'bg-green-100/90 text-green-800'  :
                                                                     'bg-white/90 text-gray-800'"
                      >{{ animal.rarity }}</span>
                    </div>

                    <!-- Vergrendeld-badge onderaan zodat het emoji-silhouet zichtbaar blijft -->
                    @if (!animal.latest_observation) {
                      <div class="absolute bottom-0 left-0 right-0 flex justify-center pb-2.5">
                        <span class="bg-gray-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur shadow">
                          🔒 Nog niet ontdekt
                        </span>
                      </div>
                    }
                  </div>

                  <div class="p-4 flex flex-col gap-1">
                    <div class="flex items-center justify-between text-xs text-gray-400">
                      <span>{{ animal.category }}</span>
                      @if (animal.latest_observation) {
                        <span class="text-emerald-600 font-semibold">✓ Gespot</span>
                      }
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-emerald-600 transition-colors leading-tight">{{ animal.dutch_name }}</h3>
                    <p class="text-xs italic text-gray-500 dark:text-gray-400">{{ animal.scientific_name }}</p>
                  </div>
                </div>
              } @empty {
                <div class="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <div class="text-4xl mb-2">🌿</div>
                  <p class="text-gray-500 dark:text-gray-400 font-medium">Geen dieren gevonden die aan je filters voldoen.</p>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Schermvullend Detailoverzicht (Modal / Fullscreen view) -->
      @if (selectedAnimal(); as animal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div class="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-100 dark:border-gray-800 relative my-8">
            <!-- Sluitknop -->
            <button 
              type="button" 
              (click)="closeDetail()"
              class="absolute top-4 right-4 z-10 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full p-2.5 shadow transition-colors cursor-pointer backdrop-blur"
            >
              ✕
            </button>

            <div class="max-h-[90vh] overflow-y-auto">
              <!-- Header Afbeelding: observatiefoto bij ontdekte dieren, silhouet bij onbekenden -->
              <div class="h-72 bg-gray-900 relative">
                @if (animal.latest_observation) {
                  <img
                    [src]="'http://localhost:8000' + animal.latest_observation.image_path"
                    [alt]="animal.dutch_name"
                    class="w-full h-full object-cover"
                  >
                } @else if (animal.image_url) {
                  <img
                    [src]="'http://localhost:8000' + animal.image_url"
                    [alt]="animal.dutch_name"
                    class="w-full h-full object-cover brightness-0 opacity-30"
                  >
                } @else {
                  <!-- Geen afbeelding: categorie-icoon als placeholder -->
                  <div class="w-full h-full flex items-center justify-center bg-gray-800">
                    <span class="text-8xl opacity-20">{{ categoryIcon(animal.category) }}</span>
                  </div>
                }
                <div class="absolute top-4 left-4 z-10">
                  <span class="px-3 py-1 text-xs font-semibold rounded-full bg-white/90 backdrop-blur shadow-sm text-gray-800">
                    {{ animal.rarity }}
                  </span>
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6 text-white">
                  @if (animal.latest_observation) {
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/80 text-white backdrop-blur">{{ animal.category }}</span>
                    </div>
                  }
                  <h2 class="text-3xl font-black">{{ animal.dutch_name }}</h2>
                  <p class="text-sm italic text-gray-300">{{ animal.scientific_name }}</p>
                </div>
              </div>

              <!-- Content secties -->
              <div class="p-8 space-y-8">
                @if (animal.latest_observation) {
                  <!-- Beschrijving -->
                  <div>
                    <h4 class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Over dit dier</h4>
                    <p class="text-gray-700 dark:text-gray-300 text-base leading-relaxed">{{ animal.description }}</p>
                  </div>

                  <!-- Biologische Fiche (extra_info) -->
                  @if (animal.extra_info) {
                    <div class="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border border-gray-200/80 dark:border-gray-700/80 space-y-4">
                      <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span>🧬</span> Biologische Fiche
                      </h4>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        @if (animal.extra_info['habitat']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Habitat</span>
                            <span class="text-gray-800 dark:text-gray-200 font-medium">{{ animal.extra_info['habitat'] }}</span>
                          </div>
                        }
                        @if (animal.extra_info['diet']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Dieet</span>
                            <span class="text-gray-800 dark:text-gray-200 font-medium">{{ animal.extra_info['diet'] }}</span>
                          </div>
                        }
                        @if (animal.extra_info['size']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Afmetingen</span>
                            <span class="text-gray-800 dark:text-gray-200 font-medium">{{ animal.extra_info['size'] }}</span>
                          </div>
                        }
                        @if (animal.extra_info['reproduction']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Voortplanting</span>
                            <span class="text-gray-800 dark:text-gray-200 font-medium">{{ animal.extra_info['reproduction'] }}</span>
                          </div>
                        }
                        @if (animal.extra_info['status_bedreiging']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Bedreigingsstatus</span>
                            <span class="text-emerald-700 dark:text-emerald-400 font-bold">{{ animal.extra_info['status_bedreiging'] }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Waarnemingen tijdlijn -->
                  @if (filteredDetailObservations().length > 0) {
                    <div class="space-y-3">
                      <h4 class="text-sm font-bold text-emerald-900 dark:text-emerald-400 flex items-center gap-2">
                        <span>📸</span> Alle Waarnemingen
                        <span class="ml-1 text-xs font-normal text-gray-400">({{ filteredDetailObservations().length }})</span>
                      </h4>
                      @for (obs of filteredDetailObservations(); track obs.id) {
                        <div class="bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50 overflow-hidden flex flex-col sm:flex-row items-stretch">
                            <img
                              [src]="'http://localhost:8000' + (obs.thumbnail_path ?? obs.image_path)"
                              alt="Waarneming foto"
                              class="w-full h-36 sm:w-36 sm:h-auto sm:self-stretch shrink-0 object-cover rounded-t-2xl sm:rounded-t-none sm:rounded-l-2xl border-b sm:border-b-0 sm:border-r border-emerald-200/80 dark:border-emerald-800/50"
                            />
                            <div class="flex flex-col gap-3 p-4 text-sm text-emerald-900 dark:text-emerald-300 flex-1 min-w-0">
                              @if (obs.is_wild) {
                                <span class="inline-flex w-fit items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400">🌿 In het wild</span>
                              } @else {
                                <span class="inline-flex w-fit items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400">🦁 In de dierentuin</span>
                              }
                              <div class="flex flex-col gap-1">
                                <p class="tabular-nums"><strong>Datum:</strong> {{ obs.timestamp | date:'dd-MM-yyyy HH:mm:ss' }}</p>
                                @if (obs.latitude != null && obs.longitude != null) {
                                  <p class="tabular-nums"><strong>Coördinaten:</strong> {{ obs.latitude | number:'1.4-4' }}° N, {{ obs.longitude | number:'1.4-4' }}° O</p>
                                }
                              </div>
                              @if (hasPhotoExif(obs)) {
                                <div class="flex flex-row flex-wrap gap-2 text-xs tabular-nums">
                                  @if (obs.iso) {
                                    <span class="rounded-lg bg-white/70 dark:bg-gray-900/40 px-2 py-1 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200">
                                      ISO {{ obs.iso }}
                                    </span>
                                  }
                                  @if (obs.aperture) {
                                    <span class="rounded-lg bg-white/70 dark:bg-gray-900/40 px-2 py-1 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200">
                                      f/{{ obs.aperture | number:'1.0-1' }}
                                    </span>
                                  }
                                  @if (obs.focal_length) {
                                    <span class="rounded-lg bg-white/70 dark:bg-gray-900/40 px-2 py-1 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200">
                                      {{ obs.focal_length | number:'1.0-0' }} mm
                                    </span>
                                  }
                                  @if (obs.shutter_speed) {
                                    <span class="rounded-lg bg-white/70 dark:bg-gray-900/40 px-2 py-1 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200">
                                      {{ obs.shutter_speed }}
                                    </span>
                                  }
                                  @if (obs.camera_model) {
                                    <span class="rounded-lg bg-white/70 dark:bg-gray-900/40 px-2 py-1 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200">
                                      {{ obs.camera_model }}
                                    </span>
                                  }
                                </div>
                              }
                              @if (obs.notes) {
                                <p class="truncate"><strong>Notities:</strong> {{ obs.notes }}</p>
                              }
                              <div class="flex flex-row justify-between items-end mt-auto pt-2 gap-3 w-full">
                                <div class="flex flex-col gap-1 min-w-0">
                                  <p><strong>Match score:</strong> {{ (obs.confidence * 100).toFixed(1) }}%</p>
                                  @if (obs.latitude != null && obs.longitude != null) {
                                    <a
                                      routerLink="/map"
                                      [queryParams]="{ lat: obs.latitude, lng: obs.longitude }"
                                      class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors w-fit"
                                    >🗺️ Bekijk op kaart →</a>
                                  }
                                </div>
                                <button
                                  type="button"
                                  (click)="confirmDeleteObservation(obs.id, animal.id)"
                                  class="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                                >🗑️ Verwijderen</button>
                              </div>
                            </div>
                        </div>
                      }
                    </div>
                  }
                } @else {
                  <!-- Vergrendeld / Nog niet ontdekt -->
                  <div class="bg-amber-50/60 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-6 text-center space-y-3">
                    <div class="text-3xl">🔒</div>
                    <h3 class="text-lg font-bold text-amber-900 dark:text-amber-400">Nog niet ontdekt in het wild</h3>
                    <p class="text-sm text-amber-800 dark:text-amber-300 max-w-md mx-auto">
                      Dit dier is nog niet waargenomen in het wild. Trek de natuur in en voeg een observatie toe om het biologisch paspoort te ontgrendelen!
                    </p>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class CodexComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** Zelfde host als de dierkaarten: `http://localhost:8000` + image_path / image_url. */
  protected readonly backendUrl = 'http://localhost:8000';

  protected readonly animals = signal<Animal[]>([]);
  protected readonly loading = signal<boolean>(true);
  // Bijhouden welke afbeeldingen niet geladen kunnen worden → toon categorie-emoji als fallback
  protected readonly brokenImages = signal<ReadonlySet<number>>(new Set<number>());
  /** Alle waarnemingen van het geselecteerde dier (opgehaald via detail-endpoint) */
  protected readonly detailObservations = signal<Observation[]>([]);
  
  protected readonly categories = ['Alle klassen', 'Zoogdieren', 'Vogels', 'Insecten', 'Reptielen & Amfibieën'];
  protected readonly selectedCategory = signal<string>('Alle klassen');

  protected readonly origins = [
    { id: 'all' as const, emoji: '🌍', title: 'Alle' },
    { id: 'wild' as const, emoji: '🌿', title: 'In het wild' },
    { id: 'zoo' as const, emoji: '🦁', title: 'In de dierentuin' },
  ];
  protected readonly selectedOrigin = signal<'all' | 'wild' | 'zoo'>('all');

  protected readonly statuses = [
    { id: 'all', label: 'Alles' },
    { id: 'discovered', label: 'Ontdekt' },
    { id: 'undiscovered', label: 'Onbekend' }
  ];
  protected readonly selectedStatus = signal<string>('all');

  protected readonly rarities = [
    { id: 'all',           label: 'Alle' },
    { id: 'Bedreigd',      label: '⚠️ Bedreigd' },
    { id: 'Zeldzaam',      label: '🟠 Zeldzaam' },
    { id: 'Vrij algemeen', label: '🟡 Vrij algemeen' },
    { id: 'Algemeen',      label: '🟢 Algemeen' },
  ];
  protected readonly selectedRarity = signal<string>('all');

  protected readonly searchQuery = signal<string>('');
  protected readonly selectedAnimal = signal<Animal | null>(null);

  /** Waarnemingen in de detail-modal, gefilterd op actieve herkomst */
  protected readonly filteredDetailObservations = computed(() => {
    const origin = this.selectedOrigin();
    const list = this.detailObservations();
    if (origin === 'all') return list;
    if (origin === 'wild') return list.filter((o) => o.is_wild);
    return list.filter((o) => !o.is_wild);
  });

  private pendingSpeciesId: number | null = null;

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const raw = params['speciesId'];
      const id = parseInt(raw ?? '', 10);
      this.pendingSpeciesId = Number.isNaN(id) ? null : id;
      this.tryOpenSpeciesFromQuery();
    });

    this.apiService.getCodex().subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : [];
        this.animals.set(list);
        this.loading.set(false);
        this.tryOpenSpeciesFromQuery();
      },
      error: (err) => {
        console.error('Fout bij ophalen codex:', err);
        this.loading.set(false);
      }
    });
  }

  private tryOpenSpeciesFromQuery(): void {
    const speciesId = this.pendingSpeciesId;
    if (speciesId == null || this.loading()) return;
    const target = this.animals().find((a) => a.id === speciesId);
    if (target) {
      this.openDetail(target);
      this.pendingSpeciesId = null;
    }
  }

  protected onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  /** Gedeelde zoekhulp */
  private applySearch(list: Animal[], query: string): Animal[] {
    if (!query) return list;
    return list.filter(a =>
      a.dutch_name.toLowerCase().includes(query) ||
      a.scientific_name.toLowerCase().includes(query)
    );
  }

  private matchesOrigin(animal: Animal): boolean {
    const origin = this.selectedOrigin();
    if (origin === 'all') return true;
    const latest = animal.latest_observation;
    if (!latest) return false;
    return origin === 'wild' ? latest.is_wild : !latest.is_wild;
  }

  /** Basislijst voor herkomstcounts: alles BEHALVE herkomstfilter */
  private baseForOrigin = computed(() => {
    let list = this.animals();
    const cat    = this.selectedCategory();
    const status = this.selectedStatus();
    const rarity = this.selectedRarity();
    const query  = this.searchQuery().toLowerCase().trim();
    if (cat !== 'Alle klassen')        list = list.filter(a => a.category === cat);
    if (status === 'discovered')       list = list.filter(a => !!a.latest_observation);
    if (status === 'undiscovered')     list = list.filter(a => !a.latest_observation);
    if (rarity !== 'all')              list = list.filter(a => a.rarity === rarity);
    return this.applySearch(list, query);
  });

  /** Basislijst voor categoriecounts: alles BEHALVE categoriefilter */
  private baseForCategory = computed(() => {
    let list = this.animals();
    const status = this.selectedStatus();
    const rarity = this.selectedRarity();
    const query  = this.searchQuery().toLowerCase().trim();
    if (status === 'discovered')   list = list.filter(a => !!a.latest_observation);
    if (status === 'undiscovered') list = list.filter(a => !a.latest_observation);
    if (rarity !== 'all')          list = list.filter(a => a.rarity === rarity);
    list = list.filter((a) => this.matchesOrigin(a));
    return this.applySearch(list, query);
  });

  /** Basislijst voor statuscounts: alles BEHALVE statusfilter */
  private baseForStatus = computed(() => {
    let list = this.animals();
    const cat    = this.selectedCategory();
    const rarity = this.selectedRarity();
    const query  = this.searchQuery().toLowerCase().trim();
    if (cat !== 'Alle klassen')   list = list.filter(a => a.category === cat);
    if (rarity !== 'all')         list = list.filter(a => a.rarity === rarity);
    list = list.filter((a) => this.matchesOrigin(a));
    return this.applySearch(list, query);
  });

  /** Basislijst voor raritycounts: alles BEHALVE rarityfilter */
  private baseForRarity = computed(() => {
    let list = this.animals();
    const cat    = this.selectedCategory();
    const status = this.selectedStatus();
    const query  = this.searchQuery().toLowerCase().trim();
    if (cat !== 'Alle klassen')        list = list.filter(a => a.category === cat);
    if (status === 'discovered')       list = list.filter(a => !!a.latest_observation);
    if (status === 'undiscovered')     list = list.filter(a => !a.latest_observation);
    list = list.filter((a) => this.matchesOrigin(a));
    return this.applySearch(list, query);
  });

  /** Aantallen per herkomstfilter-optie */
  protected originCounts = computed(() => {
    const base = this.baseForOrigin();
    let wild = 0;
    let zoo = 0;
    for (const a of base) {
      const latest = a.latest_observation;
      if (!latest) continue;
      if (latest.is_wild) wild++;
      else zoo++;
    }
    return { all: base.length, wild, zoo };
  });

  /** Aantallen per categoriefilter-optie */
  protected categoryCounts = computed(() => {
    const base = this.baseForCategory();
    const counts: Record<string, number> = { 'Alle klassen': base.length };
    for (const a of base) counts[a.category] = (counts[a.category] ?? 0) + 1;
    return counts;
  });

  /** Aantallen per statusfilter-optie */
  protected statusCounts = computed(() => {
    const base = this.baseForStatus();
    return {
      all:          base.length,
      discovered:   base.filter(a => !!a.latest_observation).length,
      undiscovered: base.filter(a => !a.latest_observation).length,
    };
  });

  /** Aantallen per zeldzaamheidsfilter-optie */
  protected rarityCounts = computed(() => {
    const base = this.baseForRarity();
    const counts: Record<string, number> = { all: base.length };
    for (const a of base) counts[a.rarity] = (counts[a.rarity] ?? 0) + 1;
    return counts;
  });

  protected filteredAnimals = computed(() => {
    let list = this.animals();
    const cat    = this.selectedCategory();
    const status = this.selectedStatus();
    const rarity = this.selectedRarity();
    const query  = this.searchQuery().toLowerCase().trim();

    if (cat !== 'Alle klassen')        list = list.filter(a => a.category === cat);
    if (status === 'discovered')       list = list.filter(a => !!a.latest_observation);
    if (status === 'undiscovered')     list = list.filter(a => !a.latest_observation);
    if (rarity !== 'all')              list = list.filter(a => a.rarity === rarity);
    list = list.filter((a) => this.matchesOrigin(a));
    list = this.applySearch(list, query);

    return [...list].sort((a, b) => a.dutch_name.localeCompare(b.dutch_name));
  });

  protected getStatusCount(id: string): number {
    const counts = this.statusCounts();
    return counts[id as keyof typeof counts] ?? 0;
  }

  protected getRarityCount(id: string): number {
    return this.rarityCounts()[id] ?? 0;
  }

  protected markImageBroken(animalId: number): void {
    const current = this.brokenImages();
    if (!current.has(animalId)) {
      this.brokenImages.set(new Set([...current, animalId]));
    }
  }

  protected hasPhotoExif(obs: Observation): boolean {
    return (
      obs.iso != null ||
      obs.aperture != null ||
      obs.focal_length != null ||
      (obs.shutter_speed != null && obs.shutter_speed !== '') ||
      (obs.camera_model != null && obs.camera_model !== '')
    );
  }

  protected categoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Zoogdieren': '🦊',
      'Vogels': '🦅',
      'Insecten': '🦋',
      'Reptielen & Amfibieën': '🦎',
    };
    return icons[category] ?? '🌿';
  }

  protected openDetail(animal: Animal): void {
    this.selectedAnimal.set(animal);
    this.detailObservations.set([]);
    // Haal alle waarnemingen + verse data op via het detail-endpoint
    this.apiService.getAnimalDetail(animal.id).subscribe({
      next: (detail) => {
        this.detailObservations.set(detail.all_observations ?? []);
        // Update ook het dier in de grid (latest_observation kan veranderd zijn)
        this.selectedAnimal.set({ ...detail });
      },
    });
  }

  protected closeDetail(): void {
    this.selectedAnimal.set(null);
    this.detailObservations.set([]);
  }

  protected confirmDeleteObservation(obsId: number, animalId: number): void {
    if (!this.authService.isLoggedIn()) {
      // speciesId in de returnUrl: na het inloggen opent de detailmodal opnieuw
      void this.router.navigate(['/login'], { queryParams: { returnUrl: `/?speciesId=${animalId}` } });
      return;
    }
    if (!confirm('Weet je zeker dat je deze waarneming wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
    this.apiService.deleteObservation(obsId).subscribe({
      next: () => {
        // Verwijder lokaal uit de tijdlijn
        const remaining = this.detailObservations().filter(o => o.id !== obsId);
        this.detailObservations.set(remaining);

        // Update het dier in de animals-lijst en in de selectedAnimal
        const latestObs = remaining[0] ?? null;
        this.animals.update(list =>
          list.map(a => a.id === animalId ? { ...a, latest_observation: latestObs } : a)
        );
        const current = this.selectedAnimal();
        if (current && current.id === animalId) {
          this.selectedAnimal.set({ ...current, latest_observation: latestObs, all_observations: remaining });
        }
      },
      error: () => alert('Verwijderen mislukt. Probeer opnieuw.'),
    });
  }
}
