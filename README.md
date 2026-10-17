# Wizard-Punktezähler

Deutschsprachige Blazor-WebAssembly-PWA für Wizard-Partien. Sie unterstützt die Einrichtung mit drei bis sechs Spielenden, die Auswahl der Vorhersagesummen-Regel und Sonderkarten sowie Vorhersage und Wertung der ersten Stichrunde.

## Voraussetzungen

Zum Starten wird das .NET 10 SDK benötigt. Für die Browserprüfungen zusätzlich Node.js 24.

## Starten

Im Repository-Wurzelverzeichnis ausführen:

```sh
dotnet run --project src/BlockDerWahrheit.Web/BlockDerWahrheit.Web.csproj --no-launch-profile --urls http://127.0.0.1:5178
```

Anschließend im Browser <http://127.0.0.1:5178> öffnen. Die `wwwroot/index.html` nicht direkt über `file://` starten.

## Bauen und Browserprüfungen

Den Build im Repository-Wurzelverzeichnis starten:

```sh
dotnet build src/BlockDerWahrheit.slnx
```

Für die Browserprüfungen in den Projektordner wechseln. Chromium muss nur einmal installiert werden:

```sh
cd src/BlockDerWahrheit.Web
npm ci
npx playwright install chromium
npm run test:browser
npm run test:offline
```

## Deployment auf GitHub Pages

Die Anwendung wird unter <https://ventil99.github.io/BlockDerWahrheit/> veröffentlicht.
Im Repository muss unter **Settings → Pages → Build and deployment → Source**
die Option **GitHub Actions** ausgewählt sein.

Der Workflow `.github/workflows/deploy-pages.yml` prüft den Release-Publish bei
Pull Requests nach `main`. Nach einem Push bzw. Merge nach `main` veröffentlicht
er `publish/wwwroot` automatisch auf GitHub Pages. Über **Actions → Deploy GitHub
Pages → Run workflow** kann das Deployment auf `main` erneut gestartet werden.

Nur im Workflow wird der HTML-Basispfad vor dem Publish auf `/BlockDerWahrheit/`
gesetzt, damit auch die Prüfsummen des PWA-Caches stimmen. Lokal bleibt `/`
erhalten; der veröffentlichte Service Worker verwendet seinen Registrierungsbereich.

Nach dem ersten Deployment die Seite öffnen, eine Partie starten und nach
erfolgreicher Service-Worker-Aktivierung das Neuladen im Offline-Modus prüfen.
