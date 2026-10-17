import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function fillNames(page, names) {
  for (let index = 0; index < names.length; index++) {
    await page.getByLabel(`Name für Spielende ${index + 1}`).fill(names[index]);
  }
}

async function confirmZeroPredictions(page) {
  for (const input of await page.getByRole('spinbutton').all()) await input.fill('0');
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
}

async function confirmZeroPredictionsWithKeyboard(page) {
  const inputs = await page.getByRole('spinbutton').all();
  for (const input of inputs) await input.fill('0');
  const confirm = page.getByRole('button', { name: 'Vorhersagen bestätigen' });
  await inputs.at(-1).press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Enter');
}

async function scoreRound(page, trickCount) {
  await confirmZeroPredictions(page);
  await enterScore(page, trickCount);
}

async function enterScore(page, trickCount, useKeyboard = false) {
  const scores = await page.getByRole('spinbutton').all();
  for (const [index, input] of scores.entries()) await input.fill(index === 0 ? String(trickCount) : '0');
  const calculate = page.getByRole('button', { name: 'Wertung berechnen' });
  if (useKeyboard) {
    await calculate.focus();
    await page.keyboard.press('Enter');
  } else {
    await calculate.click();
  }
}

async function prepareOfflinePage(page, context) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Wer spielt mit?' })).toBeVisible();
  await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.close();
  const offlinePage = await context.newPage();
  await offlinePage.goto('./');
  await expect(offlinePage.getByRole('heading', { name: /Wer spielt mit|Eure Wizard-Partien/ })).toBeVisible();
  return offlinePage;
}

async function assertAllInstallAssetsAreCached(page) {
  const manifest = await readFile('../../publish/wwwroot/service-worker-assets.js', 'utf8');
  const installAssets = [...manifest.matchAll(/"url": "([^"]+)"/g)]
    .map(([, url]) => url)
    .filter((url) => /\.(dll|pdb|wasm|html|js|json|css|woff|png|jpe?g|gif|ico|blat|dat|webmanifest)$/.test(url));
  const cachedAssets = await page.evaluate(async () => {
    const cacheName = (await caches.keys()).find((name) => name.startsWith('offline-cache-'));
    return cacheName ? (await (await caches.open(cacheName)).keys()).map((request) => request.url) : [];
  });
  expect(cachedAssets).toEqual(expect.arrayContaining(installAssets.map((url) => new URL(url, page.url()).href)));
}

test('installierbar nach Erstaufruf und nach Neustart offline vollständig bedienbar', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Wer spielt mit?' })).toBeVisible();

  const manifest = await page.evaluate(async () => {
    const response = await fetch(document.querySelector('link[rel="manifest"]').href);
    return response.json();
  });
  expect(manifest.name).toBe('Wizard-Punktezähler');
  expect(manifest.short_name).toBe('Wizard');
  expect(manifest.start_url).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(manifest.prefer_related_applications).toBe(false);
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Wer spielt mit?' })).toBeVisible();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await assertAllInstallAssetsAreCached(page);

  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  await cdp.detach();

  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await scoreRound(page, 1);
  await expect(page.getByRole('heading', { name: 'Euer Ergebnis' })).toBeVisible();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);

  await context.setOffline(true);
  await page.close();
  const offlinePage = await context.newPage();
  const failedRequests = [];
  context.on('requestfailed', (request) => failedRequests.push(request.url()));
  await offlinePage.goto('./');
  await expect(offlinePage.getByRole('article')).toHaveCount(1);
  for (const width of [320, 390, 768, 1280]) {
    await offlinePage.setViewportSize({ width, height: 844 });
    expect(await offlinePage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await offlinePage.getByRole('button', { name: 'Partie öffnen: Ada, Bela, Cora' }).click();
  await expect(offlinePage.getByText('Bisherige Ergebnisse (1 Stichrunde)')).toBeVisible();
  await offlinePage.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await scoreRound(offlinePage, 2);
  await offlinePage.getByRole('button', { name: 'Zur Partienübersicht' }).click();

  await offlinePage.getByRole('button', { name: 'Neue Partie' }).click();
  await fillNames(offlinePage, ['Dora', 'Emil', 'Frieda']);
  await offlinePage.getByRole('button', { name: 'Partie starten' }).click();
  for (const row of await offlinePage.locator('.prediction-list .entry-row').all()) {
    const name = await row.locator('label').innerText();
    await row.locator('input').fill(name === 'Dora' ? '1' : '0');
  }
  await offlinePage.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(offlinePage.getByRole('article')).toHaveCount(2);

  const downloadPromise = offlinePage.waitForEvent('download');
  await offlinePage.getByRole('button', { name: 'Partiensammlung exportieren' }).click();
  const backup = await readFile(await (await downloadPromise).path(), 'utf8');
  const collection = JSON.parse(backup);
  expect(collection.FormatVersion).toBe(1);
  expect(collection.Games).toHaveLength(2);
  expect(collection.Games.find((game) => game.Players[0].Name === 'Ada').CompletedRounds).toHaveLength(2);

  await offlinePage.getByRole('button', { name: 'Neue Partie' }).click();
  await fillNames(offlinePage, ['Gero', 'Hedi', 'Ingo']);
  await offlinePage.getByRole('button', { name: 'Partie starten' }).click();
  await offlinePage.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(offlinePage.getByRole('article')).toHaveCount(3);
  for (const width of [320, 390, 768, 1280]) {
    await offlinePage.setViewportSize({ width, height: 844 });
    expect(await offlinePage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  const collectionTargetHeights = await offlinePage.locator('button, .file-button')
    .evaluateAll((targets) => targets.map((target) => target.getBoundingClientRect().height));
  expect(Math.min(...collectionTargetHeights)).toBeGreaterThanOrEqual(44);
  await offlinePage.setViewportSize({ width: 1280, height: 844 });

  offlinePage.once('dialog', (dialog) => dialog.accept());
  await offlinePage.getByLabel('Partiensammlung importieren').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await expect(offlinePage.getByRole('article')).toHaveCount(2);
  await expect(offlinePage.getByRole('article').filter({ hasText: 'Gero, Hedi, Ingo' })).toHaveCount(0);

  await offlinePage.reload();
  await expect(offlinePage.getByRole('article')).toHaveCount(2);
  await offlinePage.getByRole('button', { name: 'Partie öffnen: Dora, Emil, Frieda' }).click();
  await expect(offlinePage.getByLabel('Dora')).toHaveValue('1');
  await offlinePage.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await offlinePage.getByRole('button', { name: 'Partie öffnen: Ada, Bela, Cora' }).click();
  await expect(offlinePage.getByText('Bisherige Ergebnisse (2 Stichrunden)')).toBeVisible();
  expect(failedRequests).toEqual([]);
});

test('regeln, Sonderkarten, Partienvorlagen und reguläres Spielende funktionieren offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  const offlinePage = await prepareOfflinePage(page, context);
  const failedRequests = [];
  context.on('requestfailed', (request) => failedRequests.push(request.url()));

  for (const width of [320, 390, 768, 1280]) {
    await offlinePage.setViewportSize({ width, height: 844 });
    expect(await offlinePage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await offlinePage.setViewportSize({ width: 1280, height: 844 });
  await offlinePage.getByRole('button', { name: 'Partie starten' }).focus();
  await offlinePage.keyboard.press('Enter');
  await expect(offlinePage.getByRole('alert')).toContainText('Namen');

  await fillNames(offlinePage, ['Ada', 'Bela', 'Cora']);
  await offlinePage.getByRole('radio', { name: 'Vorhersagesumme muss von der Stichzahl abweichen' }).check();
  for (const name of ['Gestaltenwandler', 'Drache', 'Fee', 'Werwolf', 'Jongleur', 'Hexe', 'Vampir']) {
    await offlinePage.getByLabel(name).uncheck();
  }
  const targetHeights = await offlinePage.locator('button, .setting-option, .card-option')
    .evaluateAll((targets) => targets.map((target) => target.getBoundingClientRect().height));
  expect(Math.min(...targetHeights)).toBeGreaterThanOrEqual(44);
  await offlinePage.getByRole('button', { name: 'Partie starten' }).click();
  for (const width of [320, 390, 768, 1280]) {
    await offlinePage.setViewportSize({ width, height: 844 });
    expect(await offlinePage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await offlinePage.setViewportSize({ width: 1280, height: 844 });

  await confirmZeroPredictionsWithKeyboard(offlinePage);
  await offlinePage.getByRole('button', { name: 'Bombe hinzufügen' }).click();
  await enterScore(offlinePage, 0, true);
  await expect(offlinePage.getByText('Ausgespielte Bomben: 1')).toBeVisible();
  await offlinePage.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await confirmZeroPredictions(offlinePage);
  await offlinePage.getByRole('button', { name: 'Wolke hinzufügen' }).click();
  const cloudDialog = offlinePage.getByRole('dialog', { name: 'Wolkenstich erfassen' });
  await cloudDialog.focus();
  await offlinePage.keyboard.press('Escape');
  await expect(cloudDialog).toHaveCount(0);
  await offlinePage.getByRole('button', { name: 'Wolke hinzufügen' }).click();
  await cloudDialog.getByLabel('Gewinnende Person').selectOption({ label: 'Ada (Vorhersage 0)' });
  await cloudDialog.getByLabel('Vorhersage um eins erhöhen').check();
  await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();
  await enterScore(offlinePage, 2);
  await expect(offlinePage.getByText('Wolkenereignisse: Ada: +1')).toBeVisible();
  await offlinePage.getByRole('button', { name: 'Partie vorzeitig beenden' }).click();
  await expect(offlinePage.getByText('Der gewertete Endstand nach Stichrunde 2 bleibt erhalten.')).toBeVisible();

  await offlinePage.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await offlinePage.getByRole('button', { name: 'Vorlage verwenden: Ada, Bela, Cora' }).click();
  await expect(offlinePage.getByRole('radio', { name: 'Vorhersagesumme muss von der Stichzahl abweichen' })).toBeChecked();
  await expect(offlinePage.getByLabel('Bombe')).toBeChecked();
  await expect(offlinePage.getByLabel('Wolke')).toBeChecked();
  await offlinePage.getByRole('button', { name: 'Partie starten' }).click();

  for (let round = 1; round <= 20; round++) {
    await expect(offlinePage.getByText(`Stichrunde ${round} von 20`)).toBeVisible();
    await scoreRound(offlinePage, round);
    if (round < 20) await offlinePage.getByRole('button', { name: `Stichrunde ${round + 1} starten` }).click();
  }
  await expect(offlinePage.getByText('Partie abgeschlossen')).toBeVisible();
  expect(failedRequests).toEqual([]);
});
