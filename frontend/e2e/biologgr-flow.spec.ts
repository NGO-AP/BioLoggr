import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Wacht tot de codex-spinner verdwenen is en er minstens één dierkaart staat. */
async function waitForCodex(page: import('@playwright/test').Page) {
  // Spinner verdwenen
  await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10_000 }).catch(() => {});
  // Minstens één kaart
  await page.waitForFunction(() => document.querySelectorAll('[class*="rounded-2xl"][class*="cursor-pointer"]').length > 0, { timeout: 10_000 });
}

// ────────────────────────────────────────────────────────────────────────────
// Test 1 — Light / Dark Mode
// ────────────────────────────────────────────────────────────────────────────

test('Test 1 – thema-toggle schakelt dark-class op <html>', async ({ page }) => {
  await page.goto('/');

  // Lees de beginstatus
  const startsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

  // Klik de toggle-knop (aria-label wisselt per thema)
  const toggleBtn = page.locator('button[aria-label]').filter({
    hasText: '',   // svg-only knop; filter op aria-label
  }).first();

  // Robuuster: zoek op aria-label die "thema" bevat
  const themeBtn = page.locator('button').filter({ has: page.locator('svg') }).and(
    page.locator('[aria-label*="thema"]')
  );
  await expect(themeBtn).toBeVisible();
  await themeBtn.click();

  // Na klik: dark-class moet omgekeerd zijn
  const nowDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(nowDark).toBe(!startsDark);

  // Klik nog een keer → terug naar beginstatus
  await themeBtn.click();
  const backToStart = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(backToStart).toBe(startsDark);
});

// ────────────────────────────────────────────────────────────────────────────
// Test 2 — Codex: kaarten renderen + modal opent
// ────────────────────────────────────────────────────────────────────────────

test('Test 2 – codex toont dierkaarten en opent detailmodal', async ({ page }) => {
  await page.goto('/');
  await waitForCodex(page);

  // --- 2a: minstens 6 kaarten (6 geseedde dieren) ---
  const cards = page.locator('h3').filter({ hasText: /\w+/ });
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(6);

  // --- 2b: klik eerste kaart → modal opent ---
  // De kaart is de cursor-pointer container; klik op de eerste dierkaart
  const firstCard = page.locator('[class*="cursor-pointer"][class*="rounded-2xl"]').first();
  const cardName = await firstCard.locator('h3').innerText();
  await firstCard.click();

  // Modal is zichtbaar: bevat de dierennaam in een h2
  const modalTitle = page.locator('div[class*="fixed"] h2');
  await expect(modalTitle).toBeVisible({ timeout: 5_000 });
  await expect(modalTitle).toContainText(cardName);

  // Modal bevat ofwel "Over dit dier" (ontdekt) of "Nog niet ontdekt" (vergrendeld)
  const modalBody = page.locator('div[class*="fixed"]');
  const hasDiscovered = await modalBody.locator('text=Over dit dier').isVisible();
  const hasLocked     = await modalBody.locator('text=Nog niet ontdekt').isVisible();
  expect(hasDiscovered || hasLocked).toBe(true);

  // --- 2c: sluitknop sluit de modal ---
  await page.locator('div[class*="fixed"] button').filter({ hasText: '✕' }).click();
  await expect(modalTitle).toBeHidden({ timeout: 3_000 });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 3 — Kaart: Leaflet container laadt + filterbalk aanwezig
// ────────────────────────────────────────────────────────────────────────────

test('Test 3 – kaartpagina laadt Leaflet-container en filterbalk', async ({ page }) => {
  await page.goto('/map');
  // Wacht tot Angular + Leaflet klaar zijn
  await page.waitForLoadState('networkidle');

  // Kaart-container aanwezig en zichtbaar
  const mapContainer = page.locator('#overview-map');
  await expect(mapContainer).toBeVisible({ timeout: 10_000 });

  // Leaflet voegt .leaflet-container toe aan het container-element ZELF (niet als child)
  await expect(mapContainer).toHaveClass(/leaflet-container/, { timeout: 12_000 });

  // Filterbalk: label "Klasse" aanwezig
  await expect(page.locator('text=Klasse').first()).toBeVisible();

  // Categorie-knoppen: "Alles" is standaard actief (emerald achtergrond)
  const allesBtn = page.locator('button').filter({ hasText: 'Alles' });
  await expect(allesBtn).toBeVisible();
  await expect(allesBtn).toHaveClass(/bg-emerald/);
});

// ────────────────────────────────────────────────────────────────────────────
// Test 4 — Waarneming formulier: wild/zoo toggle + locatiekaart + zoekbalk
// ────────────────────────────────────────────────────────────────────────────

test('Test 4 – waarnemingsformulier: type-toggle, locatiekaart en plaatsnaamzoeker', async ({ page }) => {
  await page.goto('/observe');

  // --- 4a: "In het wild"-knop standaard actief (heeft emerald border) ---
  const wildBtn = page.locator('button').filter({ hasText: 'In het wild' });
  const zooBtn  = page.locator('button').filter({ hasText: 'Dierentuin/Opvang' });
  await expect(wildBtn).toBeVisible();
  await expect(zooBtn).toBeVisible();
  await expect(wildBtn).toHaveClass(/border-emerald-500/);

  // --- 4b: klik "Dierentuin/Opvang" → amber border actief ---
  await zooBtn.click();
  await expect(zooBtn).toHaveClass(/border-amber-500/);
  // wild-knop is niet meer actief
  await expect(wildBtn).not.toHaveClass(/border-emerald-500/);

  // --- 4c: locatiekaart aanwezig en zichtbaar ---
  await page.waitForLoadState('networkidle');
  const observeMap = page.locator('#observe-map');
  await expect(observeMap).toBeVisible({ timeout: 10_000 });
  // Leaflet voegt .leaflet-container toe aan het container-element zelf (niet als child)
  await expect(observeMap).toHaveClass(/leaflet-container/, { timeout: 12_000 });

  // --- 4d: plaatsnaamzoeker aanwezig ---
  const searchInput = page.locator('input[placeholder*="Zoek een plaats"]');
  await expect(searchInput).toBeVisible();

  // Typ een zoekterm en verstuur
  await searchInput.fill('Antwerpen');
  await page.locator('button').filter({ hasText: '🔍' }).click();

  // Minstens één resultaat verschijnt in de dropdown
  const firstResult = page.locator('button').filter({ hasText: 'Antwerpen' }).first();
  await expect(firstResult).toBeVisible({ timeout: 8_000 });

  // Klik resultaat → coördinatenregel geüpdatet (lat≠default 51.2)
  await firstResult.click();
  const coordLine = page.locator('p').filter({ hasText: /°\s*N/ });
  await expect(coordLine).not.toContainText('51.2000');
});
