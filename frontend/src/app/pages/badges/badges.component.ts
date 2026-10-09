import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Badge, Stats } from '../../services/api.service';

type FilterKey = 'all' | 'challenges' | 'veldwerk' | 'vogels' | 'landdieren' | 'insecten' | 'mijlpalen';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',        label: 'Alles' },
  { key: 'challenges', label: '🔥 Uitdagingen' },
  { key: 'veldwerk',   label: 'Veldwerk' },
  { key: 'vogels',     label: 'Vogels' },
  { key: 'landdieren', label: 'Landdieren' },
  { key: 'insecten',   label: 'Insecten' },
  { key: 'mijlpalen',  label: 'Mijlpalen' },
];

@Component({
  selector: 'app-badges',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <div>
        <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">🏆 Badges & Prestaties</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">Verdien badges door dieren te ontdekken en observaties te registreren.</p>
      </div>

      @if (isLoading()) {
        <div class="flex justify-center items-center py-20">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>

      } @else if (errorMessage()) {
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm">
          {{ errorMessage() }}
        </div>

      } @else {

        <!-- ── Stats dashboard ──────────────────────────────────────────── -->
        @if (stats(); as s) {
          <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">

            <!-- Codex voortgang -->
            <div>
              <div class="flex justify-between items-end mb-2">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">📖 Codex Voltooiing</span>
                <span class="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {{ s.total_observed }} / {{ s.total_codex }} soorten
                </span>
              </div>
              <div class="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                  [style.width.%]="s.total_codex > 0 ? (s.total_observed / s.total_codex * 100) : 0"
                ></div>
              </div>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {{ s.total_codex > 0 ? ((s.total_observed / s.total_codex) * 100 | number:'1.1-1') : 0 }}% van de Benelux-codex ontdekt
              </p>
            </div>

            <!-- Tellers rij -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <!-- Badges teller -->
              <div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center border border-emerald-100 dark:border-emerald-800/30">
                <div class="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{{ s.badges_unlocked }} / {{ s.badges_total }}</div>
                <div class="text-xs font-semibold text-emerald-600 dark:text-emerald-500 mt-1">Badges Behaald</div>
              </div>

              <!-- Uitdagingen teller -->
              <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center border border-amber-100 dark:border-amber-800/30">
                <div class="text-2xl font-black text-amber-700 dark:text-amber-400 tabular-nums">{{ s.challenges_unlocked }} / {{ s.challenges_total }}</div>
                <div class="text-xs font-semibold text-amber-600 dark:text-amber-500 mt-1">🔥 Uitdagingen</div>
              </div>

              <!-- Wild vs Zoo -->
              <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center border border-blue-100 dark:border-blue-800/30">
                <div class="text-2xl font-black text-blue-700 dark:text-blue-400 tabular-nums">{{ s.wild_observations }}</div>
                <div class="text-xs font-semibold text-blue-600 dark:text-blue-500 mt-1">🌿 Wilde waarnemingen</div>
              </div>
              <div class="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 text-center border border-violet-100 dark:border-violet-800/30">
                <div class="text-2xl font-black text-violet-700 dark:text-violet-400 tabular-nums">{{ s.zoo_observations }}</div>
                <div class="text-xs font-semibold text-violet-600 dark:text-violet-500 mt-1">🏛️ Dierentuin</div>
              </div>
            </div>

            <!-- Categorie mini-bars -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              @for (cat of categoryList(s); track cat.name) {
                <div class="space-y-1">
                  <div class="flex justify-between text-xs">
                    <span class="font-medium text-gray-600 dark:text-gray-400">{{ cat.icon }} {{ cat.name }}</span>
                    <span class="tabular-nums font-bold text-gray-700 dark:text-gray-300">{{ cat.count }}</span>
                  </div>
                  <div class="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      [class]="cat.color"
                      [style.width.%]="cat.pct"
                    ></div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- ── Filter chips ──────────────────────────────────────────────── -->
        <div class="flex flex-wrap gap-2">
          @for (f of filters; track f.key) {
            <button
              type="button"
              (click)="activeFilter.set(f.key)"
              class="px-4 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer border"
              [class]="activeFilter() === f.key
                ? (f.key === 'challenges'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200 dark:shadow-amber-900'
                    : 'bg-emerald-600 text-white border-emerald-600 shadow-sm')
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
            >{{ f.label }}</button>
          }
        </div>

        <!-- ── Badge grid ────────────────────────────────────────────────── -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (badge of filteredBadges(); track badge.id) {
            <div
              class="rounded-2xl border p-5 flex items-start gap-4 relative overflow-hidden transition-all"
              [class]="badgeCardClass(badge)"
            >
              <!-- Challenge glow accent -->
              @if (badge.is_challenge) {
                <div class="absolute inset-0 rounded-2xl ring-2 ring-amber-400/40 dark:ring-amber-500/30 pointer-events-none"></div>
                <div class="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 dark:bg-amber-500/10 rounded-full blur-2xl -translate-y-6 translate-x-6 pointer-events-none"></div>
              }

              <!-- Icon -->
              <div
                class="text-3xl p-3 rounded-xl shrink-0 flex items-center justify-center relative"
                [class]="badge.is_challenge
                  ? 'bg-amber-100 dark:bg-amber-900/50'
                  : (badge.unlocked
                      ? 'bg-emerald-50 dark:bg-emerald-900/30'
                      : 'bg-gray-100 dark:bg-gray-700')"
              >{{ badge.icon }}</div>

              <!-- Content -->
              <div class="flex-1 min-w-0 relative">
                <!-- Tags row -->
                <div class="flex flex-wrap gap-1.5 mb-1.5">
                  @if (badge.is_challenge) {
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                      🔥 Uitdaging
                    </span>
                  }
                  @if (badge.unlocked) {
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                      ✓ Behaald
                    </span>
                  } @else {
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      🔒 Vergrendeld
                    </span>
                  }
                </div>

                <h3 class="font-bold text-gray-900 dark:text-gray-100 leading-tight">{{ badge.title }}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{{ badge.description }}</p>

                <!-- Unlock date OR progress bar -->
                @if (badge.unlocked && badge.unlocked_at) {
                  <p class="text-xs font-medium mt-2"
                     [class]="badge.is_challenge ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
                    Ontgrendeld op {{ badge.unlocked_at | date:'d MMM yyyy' }}
                  </p>
                } @else if (!badge.unlocked) {
                  <div class="mt-2.5 space-y-1">
                    <div class="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>Voortgang</span>
                      <span class="tabular-nums font-semibold">{{ badge.current }} / {{ badge.target }} ({{ badge.percentage }}%)</span>
                    </div>
                    <div class="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        [class]="badge.is_challenge ? 'bg-amber-400' : 'bg-emerald-500'"
                        [style.width.%]="badge.percentage"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Lege staat filter -->
        @if (filteredBadges().length === 0) {
          <div class="text-center py-16 text-gray-400 dark:text-gray-600">
            <div class="text-5xl mb-3">🔍</div>
            <p class="font-semibold">Geen badges gevonden voor dit filter.</p>
          </div>
        }
      }
    </div>
  `
})
export class BadgesComponent implements OnInit {
  private apiService = inject(ApiService);

  protected readonly filters = FILTERS;
  protected readonly badges = signal<Badge[]>([]);
  protected readonly stats = signal<Stats | null>(null);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly activeFilter = signal<FilterKey>('all');

  protected readonly filteredBadges = computed(() => {
    const f = this.activeFilter();
    const list = this.badges();
    if (f === 'all') return list;
    if (f === 'challenges') return list.filter(b => b.is_challenge);
    return list.filter(b => b.category === f);
  });

  ngOnInit(): void {
    this.apiService.getBadges().subscribe({
      next: (data) => {
        this.badges.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Kon badges niet laden. Controleer de backend verbinding.');
        this.isLoading.set(false);
      }
    });

    this.apiService.getStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => { /* stats zijn niet-kritisch */ }
    });
  }

  protected badgeCardClass(badge: Badge): string {
    if (badge.is_challenge) {
      return badge.unlocked
        ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border-amber-400 dark:border-amber-500/60 shadow-md'
        : 'bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-700/50 opacity-80';
    }
    return badge.unlocked
      ? 'bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-700 shadow-sm'
      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60';
  }

  protected categoryList(s: Stats): { name: string; icon: string; count: number; pct: number; color: string }[] {
    const maxObs = Math.max(...Object.values(s.by_category), 1);
    return [
      { name: 'Vogels',       icon: '🐦', count: s.by_category['Vogels']      ?? 0, pct: ((s.by_category['Vogels']      ?? 0) / maxObs) * 100, color: 'bg-sky-400' },
      { name: 'Zoogdieren',   icon: '🦊', count: s.by_category['Zoogdieren']  ?? 0, pct: ((s.by_category['Zoogdieren']  ?? 0) / maxObs) * 100, color: 'bg-amber-400' },
      { name: 'Insecten',     icon: '🐛', count: s.by_category['Insecten']    ?? 0, pct: ((s.by_category['Insecten']    ?? 0) / maxObs) * 100, color: 'bg-emerald-400' },
      { name: 'Reptielen',    icon: '🦎', count: s.by_category['Reptielen & Amfibieën'] ?? 0, pct: ((s.by_category['Reptielen & Amfibieën'] ?? 0) / maxObs) * 100, color: 'bg-green-500' },
    ];
  }
}
