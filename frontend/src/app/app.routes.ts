import { Routes } from '@angular/router';
import { CodexComponent } from './pages/codex/codex.component';

export const routes: Routes = [
  { path: '', component: CodexComponent },
  { path: '**', redirectTo: '' }
];
