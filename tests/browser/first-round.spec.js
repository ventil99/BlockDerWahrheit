import { expect, test } from '@playwright/test';

async function fillNames(page, names) {
  for (let index = 0; index < names.length; index++) {
    await page.getByLabel(`Name für Spielende ${index + 1}`).fill(names[index]);
  }
}

async function fillByRowName(rows, selector, values) {
  for (const row of await rows.all()) {
    const name = (await row.locator(selector).innerText()).trim();
    await row.locator('input').fill(String(values[name]));
  }
}

test('richtet eine Partie ein, prüft Eingaben und wertet eine korrekte Ansage', async ({ page }) => {
  const names = ['<b>Ada</b>', 'Bela', 'Cora'];
  await page.goto('/');

  await page.getByRole('button', { name: 'Partie starten' }).click();
  await expect(page.getByRole('alert')).toContainText('Namen');
  await page.getByLabel('Name für Spielende 1').press('Tab');
  await expect(page.getByRole('button', { name: 'Spielende 1 entfernen' })).toBeFocused();

  await page.getByRole('button', { name: 'Spielende 3 entfernen' }).click();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await expect(page.getByRole('alert')).toContainText('drei bis sechs Spielende');
  await page.getByRole('button', { name: 'Spielende hinzufügen' }).click();

  for (let index = 0; index < 3; index++) {
    await page.getByRole('button', { name: 'Spielende hinzufügen' }).click();
  }
  await expect(page.getByRole('textbox')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Spielende hinzufügen' })).toBeDisabled();
  for (const count of [6, 5, 4]) {
    await page.getByRole('button', { name: `Spielende ${count} entfernen` }).click();
  }

  await fillNames(page, names);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await expect(page.getByRole('heading', { name: 'Vorhersagen' })).toBeVisible();

  const roles = await page.locator('.turn-item p strong').allTextContents();
  const dealerSeat = names.indexOf(roles[0]);
  expect(dealerSeat).toBeGreaterThanOrEqual(0);
  expect(roles[1]).toBe(names[(dealerSeat + 1) % names.length]);
  expect(roles[2]).toBe(roles[1]);
  await expect(page.locator('b')).toHaveCount(0);

  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await expect(page.getByRole('alert')).toContainText('ganze Zahl von 0 bis 1');
  const predictionRows = page.locator('.prediction-list .entry-row');
  await predictionRows.first().locator('input').fill('2');
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await expect(page.getByRole('alert')).toContainText('ganze Zahl von 0 bis 1');
  await fillByRowName(predictionRows, 'label', { [names[0]]: 1, [names[1]]: 0, [names[2]]: 0 });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await expect(page.getByRole('heading', { name: 'Gewonnene Stiche' })).toBeVisible();

  const trickRows = page.locator('.prediction-list .entry-row');
  await fillByRowName(trickRows, '.score-name strong', { [names[0]]: 0, [names[1]]: 0, [names[2]]: 0 });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();
  await expect(page.getByRole('alert')).toContainText('genau 1 betragen');
  await fillByRowName(trickRows, '.score-name strong', { [names[0]]: 1, [names[1]]: 0, [names[2]]: 0 });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();

  const resultRows = await page.locator('tbody tr').allTextContents();
  expect(resultRows.find((row) => row.includes(names[0]))).toContain('+30');
  expect(resultRows.find((row) => row.includes(names[1]))).toContain('+20');
  expect(resultRows.find((row) => row.includes(names[2]))).toContain('+20');

  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(width);
  }
});

test('wertet eine falsche Vorhersage und Nullvorhersagen korrekt', async ({ page }) => {
  const names = ['Ada', 'Bela', 'Cora'];
  await page.goto('/');
  await fillNames(page, names);
  await page.getByRole('button', { name: 'Partie starten' }).click();

  await fillByRowName(page.locator('.prediction-list .entry-row'), 'label', {
    [names[0]]: 0,
    [names[1]]: 0,
    [names[2]]: 0,
  });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', {
    [names[0]]: 1,
    [names[1]]: 0,
    [names[2]]: 0,
  });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();

  const resultRows = await page.locator('tbody tr').allTextContents();
  expect(resultRows.find((row) => row.includes('Ada'))).toContain('-10');
  expect(resultRows.find((row) => row.includes('Bela'))).toContain('+20');
  expect(resultRows.find((row) => row.includes('Cora'))).toContain('+20');
});
