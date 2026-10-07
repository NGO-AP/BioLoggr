import { Routes } from '@angular/router';
import { CodexComponent } from './pages/codex/codex.component';
import { ObserveComponent } from './pages/observe/observe.component';

export const routes: Routes = [
  { path: '', component: CodexComponent },
  { path: 'observe', component: ObserveComponent },
  { path: '**', redirectTo: '' }
];
