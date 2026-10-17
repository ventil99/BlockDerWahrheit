import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function fillNames(page, names) {
  for (let index = 0; index < names.length; index++) {
    await page.getByLabel(`Name für Spielende ${index + 1}`).fill(names[index]);
  }
}

async function scoreRound(page, trickCount) {
  for (const input of await page.getByRole('spinbutton').all()) await input.fill('0');
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  const scores = await page.getByRole('spinbutton').all();
  for (const [index, input] of scores.entries()) await input.fill(index === 0 ? String(trickCount) : '0');
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();
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
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Partie öffnen: Ada, Bela, Cora' }).click();
  await expect(page.getByText('Bisherige Ergebnisse (1 Stichrunde)')).toBeVisible();
  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  for (const input of await page.getByRole('spinbutton').all()) await input.fill('0');
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  const scores = await page.getByRole('spinbutton').all();
  for (const [index, input] of scores.entries()) await input.fill(index === 0 ? '2' : '0');
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();

  await page.getByRole('button', { name: 'Neue Partie' }).click();
  await fillNames(page, ['Dora', 'Emil', 'Frieda']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  for (const row of await page.locator('.prediction-list .entry-row').all()) {
    const name = await row.locator('label').innerText();
    await row.locator('input').fill(name === 'Dora' ? '1' : '0');
  }
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Partiensammlung exportieren' }).click();
  const backup = await readFile(await (await downloadPromise).path(), 'utf8');
  const collection = JSON.parse(backup);
  expect(collection.FormatVersion).toBe(1);
  expect(collection.Games).toHaveLength(2);
  expect(collection.Games.find((game) => game.Players[0].Name === 'Ada').CompletedRounds).toHaveLength(2);

  await page.getByRole('button', { name: 'Neue Partie' }).click();
  await fillNames(page, ['Gero', 'Hedi', 'Ingo']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(page.getByRole('article')).toHaveCount(3);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Partiensammlung importieren').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: 'Gero, Hedi, Ingo' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Partie öffnen: Dora, Emil, Frieda' }).click();
  await expect(page.getByLabel('Dora')).toHaveValue('1');
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await page.getByRole('button', { name: 'Partie öffnen: Ada, Bela, Cora' }).click();
  await expect(page.getByText('Bisherige Ergebnisse (2 Stichrunden)')).toBeVisible();
});
