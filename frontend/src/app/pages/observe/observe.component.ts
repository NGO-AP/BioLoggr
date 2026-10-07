import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Animal, Observation, Badge } from '../../services/api.service';

interface ObservationResult {
  observation: Observation;
  animal: Animal;
  badges: Badge[];
}

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
        <div class="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6 space-y-6 animate-fadeIn">
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
export class ObserveComponent {
  private apiService = inject(ApiService);

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly notes = signal<string>('');
  
  protected readonly isUploading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<ObservationResult | null>(null);

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
      this.processFile(event.dataTransfer.files[0]);
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

    // Default GPS coördinaten (bijv. Utrecht / Nederland centrum)
    const lat = 52.0907;
    const lon = 5.1214;

    this.apiService.createObservation(formData, lat, lon).subscribe({
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
  }

  private processFile(file: File): void {
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }
}
