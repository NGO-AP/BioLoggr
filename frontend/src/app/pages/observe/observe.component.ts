import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-observe',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-black text-gray-900 mb-2">Observatie Toevoegen</h1>
      <p class="text-gray-600 mb-6">Upload een foto van een dier in de natuur om deze te laten identificeren door de AI.</p>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <!-- Drag & Drop Upload Zone -->
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

        <!-- Notitieveld -->
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

        <!-- Submit Button -->
        <button 
          type="button" 
          [disabled]="!selectedFile()"
          class="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-xl shadow transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          Observatie Versturen & Analyseren
        </button>
      </div>
    </div>
  `
})
export class ObserveComponent {
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly notes = signal<string>('');

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

  private processFile(file: File): void {
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }
}
