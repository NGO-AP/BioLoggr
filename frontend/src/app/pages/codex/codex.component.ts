import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Animal } from '../../services/api.service';

@Component({
  selector: 'app-codex',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-8">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Dieren Codex</h1>
        <p class="text-gray-600 mt-2">Ontdek alle waargenomen dieren en hun unieke eigenschappen.</p>
      </header>

      @if (loading()) {
        <div class="text-center py-12">
          <p class="text-gray-500 text-lg">Gegevens laden...</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (animal of animals(); track animal.id) {
            <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-gray-100 flex flex-col">
              <div class="h-48 bg-gray-200 relative">
                @if (animal.image_url) {
                  <img [src]="'http://localhost:8000' + animal.image_url" [alt]="animal.dutch_name" class="w-full h-full object-cover">
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-gray-400">Geen afbeelding</div>
                }
                <span class="absolute top-3 right-3 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 shadow-sm">
                  {{ animal.rarity }}
                </span>
              </div>
              <div class="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 class="text-xl font-bold text-gray-900">{{ animal.dutch_name }}</h3>
                  <p class="text-sm italic text-gray-500 mb-3">{{ animal.scientific_name }}</p>
                  <p class="text-gray-600 text-sm line-clamp-3 mb-4">{{ animal.description }}</p>
                </div>

                @if (animal.extra_info) {
                  <div class="border-t border-gray-100 pt-4 mt-auto">
                    <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Extra Info</h4>
                    <div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      @if (animal.extra_info['habitat']) {
                        <div><span class="font-medium">Habitat:</span> {{ animal.extra_info['habitat'] }}</div>
                      }
                      @if (animal.extra_info['diet']) {
                        <div><span class="font-medium">Dieet:</span> {{ animal.extra_info['diet'] }}</div>
                      }
                      @if (animal.extra_info['size']) {
                        <div><span class="font-medium">Grootte:</span> {{ animal.extra_info['size'] }}</div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <div class="col-span-full text-center py-12">
              <p class="text-gray-500 text-lg">Geen dieren gevonden in de codex.</p>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class CodexComponent implements OnInit {
  private apiService = inject(ApiService);

  animals = signal<Animal[]>([]);
  loading = signal<boolean>(true);

  ngOnInit() {
    this.apiService.getCodex().subscribe({
      next: (data) => {
        this.animals.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Fout bij ophalen codex:', err);
        this.loading.set(false);
      }
    });
  }
}
