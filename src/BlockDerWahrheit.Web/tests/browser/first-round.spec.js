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

async function confirmZeroPredictions(page) {
  for (const input of await page.getByRole('spinbutton').all()) await input.fill('0');
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
}

async function scoreCurrentRound(page, trickCount) {
  await confirmZeroPredictions(page);
  await expect(page.getByRole('heading', { name: 'Gewonnene Stiche' })).toBeVisible();
  const scoreInputs = await page.getByRole('spinbutton').all();
  for (const [index, input] of scoreInputs.entries()) await input.fill(index === 0 ? String(trickCount) : '0');
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();
}

async function startGameWithPlayers(page, playerCount) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Wer spielt mit|Eure Wizard-Partien/ })).toBeVisible();
  const newGame = page.getByRole('button', { name: 'Neue Partie' });
  if (await newGame.count()) await newGame.click();
  for (let index = 3; index < playerCount; index++) {
    await page.getByRole('button', { name: 'Spielende hinzufügen' }).click();
  }
  await fillNames(page, Array.from({ length: playerCount }, (_, index) => `Person ${index + 1}`));
  await page.getByRole('button', { name: 'Partie starten' }).click();
}

test('nutzt die Standardregeln und erlaubt jede Sonderkartenauswahl', async ({ page }) => {
  const names = ['Ada', 'Bela', 'Cora'];
  await page.goto('/');
  await fillNames(page, names);

  await expect(page.getByRole('radio', { name: 'Vorhersagesumme darf der Stichzahl entsprechen' })).toBeChecked();
  const cards = page.getByRole('checkbox');
  await expect(cards).toHaveCount(9);
  for (const card of await cards.all()) await expect(card).toBeChecked();
  for (const name of ['Gestaltenwandler', 'Drache', 'Fee', 'Bombe', 'Werwolf', 'Jongleur', 'Wolke', 'Hexe', 'Vampir']) {
    await expect(page.getByLabel(name)).toBeChecked();
  }
  await expect(page.getByText('Drache und Fee werden gemeinsam empfohlen.')).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1280, height: 844 });

  await page.getByLabel('Drache').uncheck();
  await expect(page.getByLabel('Fee')).toBeChecked();
  for (const card of await cards.all()) await card.uncheck();
  await page.getByLabel('Bombe').check();
  await page.getByLabel('Vampir').check();

  await page.getByRole('button', { name: 'Partie starten' }).click();
  const settings = page.getByRole('region', { name: 'Vereinbarte Einstellungen' });
  await expect(settings).toContainText('Vorhersagesumme darf der Stichzahl entsprechen.');
  await expect(settings).toContainText('Sonderkarten: Bombe, Vampir');

  await fillByRowName(page.locator('.prediction-list .entry-row'), 'label', {
    [names[0]]: 1,
    [names[1]]: 0,
    [names[2]]: 0,
  });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await expect(page.getByRole('heading', { name: 'Gewonnene Stiche' })).toBeVisible();
  await expect(settings).toContainText('Sonderkarten: Bombe, Vampir');
});

test('erlaubt eine Partie ohne Sonderkarten', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  for (const card of await page.getByRole('checkbox').all()) await card.uncheck();

  await page.getByRole('button', { name: 'Partie starten' }).click();
  await expect(page.getByRole('region', { name: 'Vereinbarte Einstellungen' }))
    .toContainText('Sonderkarten: keine Sonderkarten');
  await fillByRowName(page.locator('.prediction-list .entry-row'), 'label', { Ada: 0, Bela: 0, Cora: 0 });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await expect(page.getByRole('heading', { name: 'Gewonnene Stiche' })).toBeVisible();
});

test('verhindert bei der alternativen Regel eine gleiche Vorhersagesumme', async ({ page }) => {
  const names = ['Ada', 'Bela', 'Cora'];
  await page.goto('/');
  await fillNames(page, names);
  await page.getByRole('radio', { name: 'Vorhersagesumme muss von der Stichzahl abweichen' }).check();
  await page.getByRole('button', { name: 'Partie starten' }).click();

  const predictions = page.locator('.prediction-list .entry-row');
  await fillByRowName(predictions, 'label', { [names[0]]: 1, [names[1]]: 0, [names[2]]: 0 });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await expect(page.getByRole('alert')).toContainText('muss von der Stichzahl (1) abweichen');
  await expect(page.getByRole('heading', { name: 'Vorhersagen' })).toBeVisible();

  await fillByRowName(predictions, 'label', { [names[0]]: 0, [names[1]]: 0, [names[2]]: 0 });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await expect(page.getByRole('heading', { name: 'Gewonnene Stiche' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Vereinbarte Einstellungen' }))
    .toContainText('Vorhersagesumme muss von der Stichzahl abweichen.');
});

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

test('zeigt den regulären Rundenspielplan für drei bis sechs Spielende', async ({ page }) => {
  for (const [playerCount, roundCount] of [[3, 20], [4, 15], [5, 12], [6, 10]]) {
    await startGameWithPlayers(page, playerCount);
    await expect(page.getByText(`Stichrunde 1 von ${roundCount}`)).toBeVisible();
  }
});

test('wechselt nach einer gewerteten Stichrunde Geber, Vorhersage und ersten Stich', async ({ page }) => {
  const names = ['Ada', 'Bela', 'Cora'];
  await page.goto('/');
  await fillNames(page, names);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  const firstRoundRoles = await page.locator('.turn-item p strong').allTextContents();
  const dealerSeat = names.indexOf(firstRoundRoles[0]);
  await scoreCurrentRound(page, 1);
  await expect(page.getByText('Bisherige Ergebnisse (1 Stichrunde)')).toBeVisible();
  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();

  const nextRoundRoles = await page.locator('.turn-item p strong').allTextContents();
  const nextDealerSeat = (dealerSeat + 1) % names.length;
  expect(nextRoundRoles[0]).toBe(names[nextDealerSeat]);
  expect(nextRoundRoles[1]).toBe(names[(nextDealerSeat + 1) % names.length]);
  expect(nextRoundRoles[2]).toBe(nextRoundRoles[1]);
  await expect(page.getByText('Stichrunde 2 von 20')).toBeVisible();
});

test('behält den gewerteten Stand bei einem ausdrücklich vorzeitigen Partieende', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await scoreCurrentRound(page, 1);
  const totalsBeforeEnding = await page.locator('tbody tr').allTextContents();

  await page.getByRole('button', { name: 'Partie vorzeitig beenden' }).click();
  await expect(page.getByText('Partie vorzeitig beendet')).toBeVisible();
  await expect(page.getByText('Der gewertete Endstand nach Stichrunde 1 bleibt erhalten.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stichrunde 2 starten' })).toHaveCount(0);
  expect(await page.locator('tbody tr').allTextContents()).toEqual(totalsBeforeEnding);
});

test('schließt alle regulären Rundenspielpläne ab und bietet danach keine nächste Runde an', async ({ page }) => {
  test.setTimeout(90_000);
  for (const [playerCount, roundCount] of [[3, 20], [4, 15], [5, 12], [6, 10]]) {
    await startGameWithPlayers(page, playerCount);

    for (let round = 1; round <= roundCount; round++) {
      await expect(page.getByText(`Stichrunde ${round} von ${roundCount}`)).toBeVisible();
      await scoreCurrentRound(page, round);
      if (round < roundCount) {
        await page.getByRole('button', { name: `Stichrunde ${round + 1} starten` }).click();
      }
    }

    await expect(page.getByText('Partie abgeschlossen')).toBeVisible();
    await expect(page.getByRole('button', { name: /Stichrunde \d+ starten/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Partie vorzeitig beenden' })).toHaveCount(0);
    await expect(page.getByText(`Bisherige Ergebnisse (${roundCount} Stichrunden)`)).toBeVisible();
  }
});

test('erfasst einen Bombenstich und wertet nur die übrigen Stiche', async ({ page }) => {
  await startGameWithPlayers(page, 3);
  await confirmZeroPredictions(page);

  const addBomb = page.getByRole('button', { name: 'Bombe hinzufügen' });
  await addBomb.click();
  await expect(addBomb).toBeDisabled();
  await expect(page.getByText('Bomben ausgespielt: 1 von 1')).toBeVisible();
  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', {
    'Person 1': 0,
    'Person 2': 0,
    'Person 3': 0,
  });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();

  await expect(page.getByRole('heading', { name: 'Euer Ergebnis' })).toBeVisible();
  await expect(page.getByText('Ausgespielte Bomben: 1')).toBeVisible();
});

test('erfasst Bomben unabhängig vom Stich und deaktiviert Plus nach zwei Bomben', async ({ page }) => {
  await startGameWithPlayers(page, 3);
  await scoreCurrentRound(page, 1);
  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await confirmZeroPredictions(page);

  const addBomb = page.getByRole('button', { name: 'Bombe hinzufügen' });
  await addBomb.click();
  await expect(page.getByText('Bomben ausgespielt: 1 von 2')).toBeVisible();
  await addBomb.click();
  await expect(addBomb).toBeDisabled();
  await expect(page.getByText('Bomben ausgespielt: 2 von 2')).toBeVisible();
  await expect(page.getByText('Gewonnene Stiche: 0 von 0.')).toBeVisible();
  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', {
    'Person 1': 0,
    'Person 2': 0,
    'Person 3': 0,
  });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();

  await expect(page.getByRole('heading', { name: 'Euer Ergebnis' })).toBeVisible();
  await expect(page.getByText('Ausgespielte Bomben: 2')).toBeVisible();
});

test('weist eine falsche Summe gewonnener Stiche nach einem Bombenstich ab', async ({ page }) => {
  await startGameWithPlayers(page, 3);
  await confirmZeroPredictions(page);
  await page.getByRole('button', { name: 'Bombe hinzufügen' }).click();
  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', {
    'Person 1': 1,
    'Person 2': 0,
    'Person 3': 0,
  });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();

  await expect(page.getByRole('alert')).toContainText('genau 0 betragen');
  await expect(page.getByRole('heading', { name: 'Gewonnene Stiche' })).toBeVisible();
});

test('zeigt die Bombenerfassung nur bei gewählter Bombe', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByLabel('Bombe').uncheck();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await confirmZeroPredictions(page);

  await expect(page.getByRole('button', { name: 'Bombe hinzufügen' })).toHaveCount(0);
});

test('erlaubt ohne Hexe höchstens eine Bombe in der Stichrunde', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByLabel('Hexe').uncheck();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await scoreCurrentRound(page, 1);
  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await confirmZeroPredictions(page);

  const addBomb = page.getByRole('button', { name: 'Bombe hinzufügen' });
  await addBomb.click();
  await expect(addBomb).toBeDisabled();
  await expect(page.getByText('Bomben ausgespielt: 1 von 1')).toBeVisible();
});

test('zeigt nach zwei Bomben in Stichrunde drei nur einen verteilbaren Stich', async ({ page }) => {
  await startGameWithPlayers(page, 3);
  await scoreCurrentRound(page, 1);
  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await scoreCurrentRound(page, 2);
  await page.getByRole('button', { name: 'Stichrunde 3 starten' }).click();
  await confirmZeroPredictions(page);

  const addBomb = page.getByRole('button', { name: 'Bombe hinzufügen' });
  await addBomb.click();
  await addBomb.click();

  await expect(addBomb).toBeDisabled();
  await expect(page.getByText('Bomben ausgespielt: 2 von 2')).toBeVisible();
  await expect(page.getByText('Gewonnene Stiche: 0 von 1.')).toBeVisible();
});

test('wendet eine Wolkenänderung auf Vorhersage und Wertung an', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Person 1', 'Person 2', 'Person 3']);
  await page.getByRole('radio', { name: 'Vorhersagesumme muss von der Stichzahl abweichen' }).check();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await fillByRowName(page.locator('.prediction-list .entry-row'), 'label', {
    'Person 1': 0,
    'Person 2': 0,
    'Person 3': 0,
  });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();

  const addCloud = page.getByRole('button', { name: 'Wolke hinzufügen' });
  await addCloud.click();
  const cloudDialog = page.getByRole('dialog', { name: 'Wolkenstich erfassen' });
  await expect(cloudDialog).toBeVisible();
  await cloudDialog.getByLabel('Gewinnende Person').selectOption({ label: 'Person 1 (Vorhersage 0)' });
  await cloudDialog.getByLabel('Vorhersage um eins verringern').check();
  await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();
  await expect(cloudDialog.getByRole('alert')).toContainText('zwischen 0 und 1 liegen');
  await expect(page.getByText('Wolken ausgespielt: 0 von 1')).toBeVisible();

  await cloudDialog.getByLabel('Vorhersage um eins erhöhen').check();
  await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();
  await expect(addCloud).toBeDisabled();
  await expect(page.getByText('Wolken ausgespielt: 1 von 1')).toBeVisible();

  await expect(page.locator('.score-name').filter({ hasText: 'Person 1' })).toContainText('Vorhersage: 1');
  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', {
    'Person 1': 1,
    'Person 2': 0,
    'Person 3': 0,
  });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();

  const playerRow = page.locator('tbody tr').filter({ hasText: 'Person 1' });
  await expect(playerRow).toContainText('0');
  await expect(playerRow).toContainText('+1');
  await expect(playerRow).toContainText('1');
  await expect(playerRow).toContainText('+30');
});

test('weist eine Wolkenänderung über der Stichzahl ab und erlaubt minus eins', async ({ page }) => {
  await startGameWithPlayers(page, 3);
  await scoreCurrentRound(page, 1);
  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await fillByRowName(page.locator('.prediction-list .entry-row'), 'label', {
    'Person 1': 2,
    'Person 2': 0,
    'Person 3': 0,
  });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();

  const addCloud = page.getByRole('button', { name: 'Wolke hinzufügen' });
  await addCloud.click();
  const cloudDialog = page.getByRole('dialog', { name: 'Wolkenstich erfassen' });
  await cloudDialog.getByLabel('Gewinnende Person').selectOption({ label: 'Person 1 (Vorhersage 2)' });
  await cloudDialog.getByLabel('Vorhersage um eins erhöhen').check();
  await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();
  await expect(cloudDialog.getByRole('alert')).toContainText('zwischen 0 und 2 liegen');
  await expect(page.getByText('Wolken ausgespielt: 0 von 2')).toBeVisible();

  await cloudDialog.getByLabel('Vorhersage um eins verringern').check();
  await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();
  await expect(page.locator('.score-name').filter({ hasText: 'Person 1' })).toContainText('Vorhersage: 1');
  await addCloud.click();
  await cloudDialog.getByLabel('Gewinnende Person').selectOption({ label: 'Person 1 (Vorhersage 1)' });
  await cloudDialog.getByLabel('Vorhersage um eins verringern').check();
  await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();

  await expect(page.locator('.score-name').filter({ hasText: 'Person 1' })).toContainText('Vorhersage: 0');
  await expect(addCloud).toBeDisabled();
  await expect(page.getByText('Wolken ausgespielt: 2 von 2')).toBeVisible();

  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', {
    'Person 1': 0,
    'Person 2': 1,
    'Person 3': 1,
  });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();
  const playerRow = page.locator('tbody tr').filter({ hasText: 'Person 1' }).last();
  await expect(playerRow).toContainText('2');
  await expect(playerRow).toContainText('-2');
  await expect(playerRow).toContainText('+20');
});

test('begrenzt Bomben und Wolken ohne Hexe gemeinsam auf die Stichzahl', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByLabel('Hexe').uncheck();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await confirmZeroPredictions(page);

  const addBomb = page.getByRole('button', { name: 'Bombe hinzufügen' });
  const addCloud = page.getByRole('button', { name: 'Wolke hinzufügen' });
  await addBomb.click();
  await expect(addCloud).toBeDisabled();
  await expect(page.getByText('Sonderkarten-Einsätze: 1 von 1 in dieser Stichrunde.')).toBeVisible();
  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', {
    Ada: 0,
    Bela: 0,
    Cora: 0,
  });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();

  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await confirmZeroPredictions(page);
  await addBomb.click();
  await expect(addCloud).toBeEnabled();
  await addCloud.click();
  const cloudDialog = page.getByRole('dialog', { name: 'Wolkenstich erfassen' });
  await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();

  await expect(addBomb).toBeDisabled();
  await expect(addCloud).toBeDisabled();
  await expect(page.getByText('Sonderkarten-Einsätze: 2 von 2 in dieser Stichrunde.')).toBeVisible();
});

test('erfasst bei Bombe und Wolke im selben Stich nur die Bombe', async ({ page }) => {
  await startGameWithPlayers(page, 3);
  await scoreCurrentRound(page, 1);
  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await fillByRowName(page.locator('.prediction-list .entry-row'), 'label', {
    'Person 1': 1,
    'Person 2': 0,
    'Person 3': 0,
  });
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();

  await expect(page.getByText('Bombe und Wolke im selben Stich? Erfasst nur die Bombe und löst das Stichergebnis selbst auf.')).toBeVisible();
  await page.getByRole('button', { name: 'Bombe hinzufügen' }).click();
  await expect(page.getByText('Bomben ausgespielt: 1 von 2')).toBeVisible();
  await expect(page.getByText('Wolken ausgespielt: 0 von 2')).toBeVisible();
  await expect(page.getByText('Vorhersage: 1', { exact: false }).first()).toBeVisible();

  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', {
    'Person 1': 1,
    'Person 2': 0,
    'Person 3': 0,
  });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();
  await expect(page.getByText('Ausgespielte Bomben: 1')).toBeVisible();
  await expect(page.getByText('Wolkenereignisse:')).toHaveCount(0);
  await expect(page.locator('tbody tr').filter({ hasText: 'Person 1' }).last()).toContainText('+30');
});

test('erlaubt zwei Wolken und insgesamt drei Sonderkarten mit Hexe', async ({ page }) => {
  await startGameWithPlayers(page, 3);
  await scoreCurrentRound(page, 1);
  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await scoreCurrentRound(page, 2);
  await page.getByRole('button', { name: 'Stichrunde 3 starten' }).click();
  await confirmZeroPredictions(page);

  const addBomb = page.getByRole('button', { name: 'Bombe hinzufügen' });
  const addCloud = page.getByRole('button', { name: 'Wolke hinzufügen' });
  for (const name of ['Person 1', 'Person 2']) {
    await addCloud.click();
    const cloudDialog = page.getByRole('dialog', { name: 'Wolkenstich erfassen' });
    await cloudDialog.getByLabel('Gewinnende Person').selectOption({ label: `${name} (Vorhersage 0)` });
    await cloudDialog.getByLabel('Vorhersage um eins erhöhen').check();
    await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();
  }
  await expect(addCloud).toBeDisabled();
  await expect(addBomb).toBeEnabled();
  await addBomb.click();

  await expect(addBomb).toBeDisabled();
  await expect(page.getByText('Wolken ausgespielt: 2 von 2')).toBeVisible();
  await expect(page.getByText('Sonderkarten-Einsätze: 3 von 3 in dieser Stichrunde.')).toBeVisible();
});

test('bewahrt mehrere unabhängige Partien und zeigt abgeschlossene Partien in der Sammlung', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await scoreCurrentRound(page, 1);
  await page.getByRole('button', { name: 'Partie vorzeitig beenden' }).click();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(page.getByRole('article')).toContainText('Abgeschlossen · vorzeitig nach Stichrunde 1');

  await page.getByRole('button', { name: 'Neue Partie' }).click();
  await fillNames(page, ['Dora', 'Erik', 'Fina']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await fillByRowName(page.locator('.prediction-list .entry-row'), 'label', { Dora: 1, Erik: 0, Fina: 0 });
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();

  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: 'Ada, Bela, Cora' })).toContainText('Abgeschlossen');
  await expect(page.getByRole('article').filter({ hasText: 'Dora, Erik, Fina' })).toContainText('Offen · Stichrunde 1 von 20 · Vorhersagen offen');
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: 'Ada, Bela, Cora' })).toContainText('Abgeschlossen');
  await page.getByRole('button', { name: 'Partie öffnen: Ada, Bela, Cora' }).click();
  await expect(page.getByText('Partie vorzeitig beendet')).toBeVisible();
  await expect(page.getByText('Bisherige Ergebnisse (1 Stichrunde)')).toBeVisible();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await page.getByRole('button', { name: 'Partie öffnen: Dora, Erik, Fina' }).click();
  await expect(page.getByRole('heading', { name: 'Vorhersagen' })).toBeVisible();
  await expect(page.getByLabel('Dora')).toHaveValue('1');
});

test('startet aus einer abgeschlossenen Partienvorlage eine bearbeitbare Partie ohne alten Spielstand', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByRole('radio', { name: 'Vorhersagesumme muss von der Stichzahl abweichen' }).check();
  for (const cardName of ['Gestaltenwandler', 'Drache', 'Fee', 'Werwolf', 'Jongleur', 'Hexe']) {
    await page.getByLabel(cardName).uncheck();
  }
  await page.getByRole('button', { name: 'Partie starten' }).click();

  await confirmZeroPredictions(page);
  await page.getByRole('button', { name: 'Bombe hinzufügen' }).click();
  for (const input of await page.getByRole('spinbutton').all()) await input.fill('0');
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();

  await page.getByRole('button', { name: 'Stichrunde 2 starten' }).click();
  await confirmZeroPredictions(page);
  await page.getByRole('button', { name: 'Wolke hinzufügen' }).click();
  const cloudDialog = page.getByRole('dialog', { name: 'Wolkenstich erfassen' });
  await cloudDialog.getByLabel('Gewinnende Person').selectOption({ label: 'Ada (Vorhersage 0)' });
  await cloudDialog.getByLabel('Vorhersage um eins erhöhen').check();
  await cloudDialog.getByRole('button', { name: 'Wolke erfassen' }).click();
  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', { Ada: 2, Bela: 0, Cora: 0 });
  await page.getByRole('button', { name: 'Wertung berechnen' }).click();
  await page.getByRole('button', { name: 'Partie vorzeitig beenden' }).click();
  await expect(page.getByText('Ausgespielte Bomben: 1')).toBeVisible();
  await expect(page.getByText('Wolkenereignisse: Ada: +1')).toBeVisible();
  const sourceTables = await page.getByRole('table').allInnerTexts();

  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  const source = page.getByRole('article').filter({ hasText: 'Ada, Bela, Cora' });
  const sourceSummary = await source.innerText();
  await expect(source).toContainText('Abgeschlossen · vorzeitig nach Stichrunde 2');
  await page.getByRole('button', { name: 'Vorlage verwenden: Ada, Bela, Cora' }).click();

  await expect(page.getByLabel('Name für Spielende 1')).toHaveValue('Ada');
  await expect(page.getByLabel('Name für Spielende 2')).toHaveValue('Bela');
  await expect(page.getByLabel('Name für Spielende 3')).toHaveValue('Cora');
  await expect(page.getByRole('radio', { name: 'Vorhersagesumme muss von der Stichzahl abweichen' })).toBeChecked();
  await expect(page.getByLabel('Bombe')).toBeChecked();
  await expect(page.getByLabel('Wolke')).toBeChecked();
  await expect(page.getByLabel('Vampir')).toBeChecked();

  await page.getByLabel('Name für Spielende 1').fill('Ari');
  await page.getByRole('radio', { name: 'Vorhersagesumme darf der Stichzahl entsprechen' }).check();
  await page.getByLabel('Vampir').uncheck();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await expect(page.getByText('Stichrunde 1 von 20')).toBeVisible();
  await confirmZeroPredictions(page);
  await expect(page.getByText('Bomben ausgespielt: 0 von 1')).toBeVisible();
  await expect(page.getByText('Wolken ausgespielt: 0 von 1')).toBeVisible();
  await expect(page.getByText('Bisherige Ergebnisse (2 Stichrunden)')).toHaveCount(0);

  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(source).toHaveText(sourceSummary);
  const newGame = page.getByRole('article').filter({ hasText: 'Ari, Bela, Cora' });
  await expect(newGame).toContainText('Offen · Stichrunde 1 von 20 · Ergebniseingabe offen');
  await expect(newGame).toContainText('Ari 0 · Bela 0 · Cora 0');
  await page.getByRole('button', { name: 'Partie öffnen: Ari, Bela, Cora' }).click();
  await expect(page.getByRole('heading', { name: 'Gewonnene Stiche' })).toBeVisible();
  await expect(page.getByText('Bomben ausgespielt: 0 von 1')).toBeVisible();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await page.getByRole('button', { name: 'Partie öffnen: Ada, Bela, Cora' }).click();
  expect(await page.getByRole('table').allInnerTexts()).toEqual(sourceTables);
  await expect(page.getByText('Ausgespielte Bomben: 1')).toBeVisible();
  await expect(page.getByText('Wolkenereignisse: Ada: +1')).toBeVisible();
});

test('stellt Vorhersagen und Ergebniseingaben nach dem Neuladen mit demselben Geber wieder her', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByLabel('Vampir').uncheck();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  const dealer = await page.locator('.turn-item').filter({ hasText: 'Geber' }).locator('strong').innerText();
  await fillByRowName(page.locator('.prediction-list .entry-row'), 'label', { Ada: 1, Bela: 0, Cora: 0 });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Eure Wizard-Partien' })).toBeVisible();
  await page.getByRole('button', { name: 'Partie öffnen: Ada, Bela, Cora' }).click();
  await expect(page.locator('.turn-item').filter({ hasText: 'Geber' }).locator('strong')).toHaveText(dealer);
  await expect(page.getByLabel('Ada')).toHaveValue('1');
  await expect(page.getByRole('region', { name: 'Vereinbarte Einstellungen' })).not.toContainText('Vampir');
  await page.getByRole('button', { name: 'Vorhersagen bestätigen' }).click();
  await fillByRowName(page.locator('.prediction-list .entry-row'), '.score-name strong', { Ada: 0, Bela: 1, Cora: 0 });
  await page.reload();

  await page.getByRole('button', { name: 'Partie öffnen: Ada, Bela, Cora' }).click();
  await expect(page.locator('.turn-item').filter({ hasText: 'Geber' }).locator('strong')).toHaveText(dealer);
  await expect(page.getByLabel('Gewonnene Stiche für Bela')).toHaveValue('1');
  await expect(page.getByRole('region', { name: 'Vereinbarte Einstellungen' })).not.toContainText('Vampir');
});

test('löscht eine Partie erst nach Bestätigung und lässt abgebrochene Löschungen bestehen', async ({ page }) => {
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await page.getByRole('button', { name: 'Neue Partie' }).click();
  await fillNames(page, ['Dora', 'Erik', 'Fina']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Partie Ada, Bela, Cora löschen' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Partie Ada, Bela, Cora löschen' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Dora, Erik, Fina');
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Dora, Erik, Fina');
});

test('meldet einen Fehler, wenn der Browser den Speicherzugriff verweigert', async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'wizard-punktezahler.partiensammlung.v1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/');
  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await expect(page.getByRole('alert')).toContainText('Die Partie konnte nicht im Browser gespeichert werden');
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(page.getByText('Änderungen an diesen Partien sind nicht dauerhaft gespeichert.')).toBeVisible();
  await expect(page.getByLabel('Partien', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Gespeicherte Partien')).toHaveCount(0);
});

test('weist beschädigte gespeicherte Partien ab und überschreibt sie nicht', async ({ page }) => {
  const payload = JSON.stringify([{
    Id: 'broken',
    Players: [],
    CompletedRounds: [],
    CloudEvents: [],
    BombCount: 0,
    SelectedSpecialCards: {},
    Phase: 1,
    DealerIndex: 0,
    EndedEarly: false,
    MustPredictionSumDiffer: false,
  }]);
  await page.addInitScript((savedPayload) => {
    localStorage.setItem('wizard-punktezahler.partiensammlung.v1', savedPayload);
  }, payload);
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('sind beschädigt und konnten nicht geladen werden');
  await expect(page.getByRole('heading', { name: 'Wer spielt mit?' })).toBeVisible();

  await fillNames(page, ['Ada', 'Bela', 'Cora']);
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await page.getByRole('button', { name: 'Zur Partienübersicht' }).click();
  await expect(page.getByText('Änderungen an diesen Partien sind nicht dauerhaft gespeichert.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('wizard-punktezahler.partiensammlung.v1'))).toBe(payload);
});

test('weist Vorhersagen außerhalb des Stichbereichs in gespeicherten Wertungen ab', async ({ page }) => {
  const payload = JSON.stringify([{
    Id: 'bad-prediction',
    Players: ['Ada', 'Bela', 'Cora'].map((Name, index) => ({
      Name,
      Prediction: index === 0 ? -2147483648 : 0,
      OriginalPrediction: 0,
      WonTricks: null,
      TotalPoints: 0,
    })),
    CompletedRounds: [],
    CloudEvents: [],
    BombCount: 0,
    SelectedSpecialCards: Object.fromEntries(
      ['Gestaltenwandler', 'Drache', 'Fee', 'Bombe', 'Werwolf', 'Jongleur', 'Wolke', 'Hexe', 'Vampir'].map((card) => [card, true]),
    ),
    Phase: 2,
    DealerIndex: 0,
    EndedEarly: false,
    MustPredictionSumDiffer: false,
  }]);
  await page.addInitScript((savedPayload) => {
    localStorage.setItem('wizard-punktezahler.partiensammlung.v1', savedPayload);
  }, payload);
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('sind beschädigt und konnten nicht geladen werden');
  expect(await page.evaluate(() => localStorage.getItem('wizard-punktezahler.partiensammlung.v1'))).toBe(payload);
});
