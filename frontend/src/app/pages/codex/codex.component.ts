import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Animal } from '../../services/api.service';

@Component({
  selector: 'app-codex',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-black text-gray-900 tracking-tight">Dieren Codex</h1>
          <p class="text-gray-600 mt-1">Ontdek alle waargenomen dieren, bekijk hun biologische fiche en ontgrendel de natuur.</p>
        </div>
        <!-- Zoekbalk -->
        <div class="relative w-full md:w-72">
          <input 
            type="text" 
            [value]="searchQuery()"
            (input)="onSearchChange($event)"
            placeholder="Zoek dier op naam..."
            class="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm pl-10"
          />
          <span class="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
        </div>
      </header>

      @if (loading()) {
        <div class="flex justify-center items-center py-24">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <!-- Linker Zijbalk (Filters) -->
          <aside class="space-y-6 lg:col-span-1">
            <!-- Categorie filter -->
            <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
              <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Taxonomische Klasse</h3>
              <div class="flex flex-col space-y-1">
                @for (cat of categories; track cat) {
                  <button 
                    type="button"
                    (click)="selectedCategory.set(cat)"
                    class="text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    [class.bg-emerald-50]="selectedCategory() === cat"
                    [class.text-emerald-700]="selectedCategory() === cat"
                    [class.text-gray-600]="selectedCategory() !== cat"
                    [class.hover:bg-gray-50]="selectedCategory() !== cat"
                  >
                    {{ cat }}
                  </button>
                }
              </div>
            </div>

            <!-- Status filter -->
            <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
              <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Ontdekkingsstatus</h3>
              <div class="flex flex-col space-y-1">
                @for (status of statuses; track status.id) {
                  <button 
                    type="button"
                    (click)="selectedStatus.set(status.id)"
                    class="text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    [class.bg-emerald-50]="selectedStatus() === status.id"
                    [class.text-emerald-700]="selectedStatus() === status.id"
                    [class.text-gray-600]="selectedStatus() !== status.id"
                    [class.hover:bg-gray-50]="selectedStatus() !== status.id"
                  >
                    {{ status.label }}
                  </button>
                }
              </div>
            </div>
          </aside>

          <!-- Rechter Overzicht (Dierkaarten) -->
          <div class="lg:col-span-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              @for (animal of filteredAnimals(); track animal.id) {
                <div 
                  (click)="openDetail(animal)"
                  class="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all border border-gray-200 flex flex-col cursor-pointer group"
                >
                  <div class="h-48 bg-gray-100 relative overflow-hidden">
                    @if (animal.latest_observation) {
                      <img
                        [src]="'http://localhost:8000' + animal.latest_observation.image_path"
                        [alt]="animal.dutch_name"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      >
                    } @else if (animal.image_url) {
                      <img
                        [src]="'http://localhost:8000' + animal.image_url"
                        [alt]="animal.dutch_name"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 brightness-0 opacity-30"
                      >
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-gray-400">Geen afbeelding</div>
                    }

                    <div class="absolute top-3 right-3">
                      <span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-white/90 backdrop-blur shadow-sm text-gray-800">
                        {{ animal.rarity }}
                      </span>
                    </div>

                    @if (!animal.latest_observation) {
                      <div class="absolute inset-0 flex items-center justify-center bg-black/5">
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
                    <h3 class="text-lg font-bold text-gray-900 group-hover:text-emerald-600 transition-colors leading-tight">{{ animal.dutch_name }}</h3>
                    <p class="text-xs italic text-gray-500">{{ animal.scientific_name }}</p>
                  </div>
                </div>
              } @empty {
                <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-gray-200">
                  <div class="text-4xl mb-2">🌿</div>
                  <p class="text-gray-500 font-medium">Geen dieren gevonden die aan je filters voldoen.</p>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Schermvullend Detailoverzicht (Modal / Fullscreen view) -->
      @if (selectedAnimal(); as animal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div class="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-100 relative my-8">
            <!-- Sluitknop -->
            <button 
              type="button" 
              (click)="closeDetail()"
              class="absolute top-4 right-4 z-10 bg-white/80 hover:bg-white text-gray-700 rounded-full p-2.5 shadow transition-colors cursor-pointer backdrop-blur"
            >
              ✕
            </button>

            <div class="max-h-[90vh] overflow-y-auto">
              <!-- Header Afbeelding -->
              <div class="h-72 bg-gray-900 relative">
                @if (animal.image_url) {
                  <img 
                    [src]="'http://localhost:8000' + animal.image_url" 
                    [alt]="animal.dutch_name" 
                    class="w-full h-full object-cover"
                    [class.brightness-0]="!animal.latest_observation"
                    [class.opacity-30]="!animal.latest_observation"
                  >
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
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Over dit dier</h4>
                    <p class="text-gray-700 text-base leading-relaxed">{{ animal.description }}</p>
                  </div>

                  <!-- Biologische Fiche (extra_info) -->
                  @if (animal.extra_info) {
                    <div class="bg-gray-50 rounded-2xl p-6 border border-gray-200/80 space-y-4">
                      <h4 class="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <span>🧬</span> Biologische Fiche
                      </h4>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        @if (animal.extra_info['habitat']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 uppercase">Habitat</span>
                            <span class="text-gray-800 font-medium">{{ animal.extra_info['habitat'] }}</span>
                          </div>
                        }
                        @if (animal.extra_info['diet']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 uppercase">Dieet</span>
                            <span class="text-gray-800 font-medium">{{ animal.extra_info['diet'] }}</span>
                          </div>
                        }
                        @if (animal.extra_info['size']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 uppercase">Afmetingen</span>
                            <span class="text-gray-800 font-medium">{{ animal.extra_info['size'] }}</span>
                          </div>
                        }
                        @if (animal.extra_info['reproduction']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 uppercase">Voortplanting</span>
                            <span class="text-gray-800 font-medium">{{ animal.extra_info['reproduction'] }}</span>
                          </div>
                        }
                        @if (animal.extra_info['status_bedreiging']) {
                          <div>
                            <span class="block text-xs font-semibold text-gray-400 uppercase">Bedreigingsstatus</span>
                            <span class="text-emerald-700 font-bold">{{ animal.extra_info['status_bedreiging'] }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Meest recente waarneming -->
                  @if (animal.latest_observation; as obs) {
                    <div class="bg-emerald-50/60 rounded-2xl p-6 border border-emerald-200/80 space-y-4">
                      <h4 class="text-sm font-bold text-emerald-900 flex items-center gap-2">
                        <span>📸</span> Jouw Laatste Waarneming
                      </h4>
                      <div class="flex flex-col sm:flex-row gap-4 items-center">
                        <img [src]="'http://localhost:8000' + obs.image_path" alt="Waarneming foto" class="w-28 h-28 rounded-xl object-cover shadow-sm border border-emerald-200" />
                        <div class="space-y-1 text-sm text-emerald-900 flex-1">
                          <p><strong>Datum:</strong> {{ obs.timestamp | date:'medium' }}</p>
                          @if (obs.latitude != null && obs.longitude != null) {
                            <p class="tabular-nums"><strong>Coördinaten:</strong> {{ obs.latitude | number:'1.4-4' }}° N, {{ obs.longitude | number:'1.4-4' }}° O</p>
                          }
                          <p><strong>Match score:</strong> {{ (obs.confidence * 100).toFixed(1) }}%</p>
                          @if (obs.notes) {
                            <p><strong>Notities:</strong> {{ obs.notes }}</p>
                          }
                        </div>
                      </div>
                    </div>
                  }
                } @else {
                  <!-- Vergrendeld / Nog niet ontdekt -->
                  <div class="bg-amber-50/60 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
                    <div class="text-3xl">🔒</div>
                    <h3 class="text-lg font-bold text-amber-900">Nog niet ontdekt in het wild</h3>
                    <p class="text-sm text-amber-800 max-w-md mx-auto">
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

  protected readonly animals = signal<Animal[]>([]);
  protected readonly loading = signal<boolean>(true);
  
  protected readonly categories = ['Alle klassen', 'Zoogdieren', 'Vogels'];
  protected readonly selectedCategory = signal<string>('Alle klassen');

  protected readonly statuses = [
    { id: 'all', label: 'Alles' },
    { id: 'discovered', label: 'Ontdekt' },
    { id: 'undiscovered', label: 'Onbekend' }
  ];
  protected readonly selectedStatus = signal<string>('all');

  protected readonly searchQuery = signal<string>('');
  protected readonly selectedAnimal = signal<Animal | null>(null);

  ngOnInit() {
    this.apiService.getCodex().subscribe({
      next: (data) => {
        this.animals.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Fout bij ophalen codex:', err);
        this.loading.set(false);
      }
    });
  }

  protected onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  protected filteredAnimals = computed(() => {
    let list = this.animals();
    const cat = this.selectedCategory();
    const status = this.selectedStatus();
    const query = this.searchQuery().toLowerCase().trim();

    if (cat && cat !== 'Alle klassen' && cat !== 'all') {
      list = list.filter(a => a.category === cat);
    }

    if (status === 'discovered') {
      list = list.filter(a => !!a.latest_observation);
    } else if (status === 'undiscovered') {
      list = list.filter(a => !a.latest_observation);
    }

    if (query) {
      list = list.filter(a => 
        a.dutch_name.toLowerCase().includes(query) || 
        a.scientific_name.toLowerCase().includes(query)
      );
    }

    return [...list].sort((a, b) => a.dutch_name.localeCompare(b.dutch_name));
  });

  protected openDetail(animal: Animal): void {
    this.selectedAnimal.set(animal);
  }

  protected closeDetail(): void {
    this.selectedAnimal.set(null);
  }
}
