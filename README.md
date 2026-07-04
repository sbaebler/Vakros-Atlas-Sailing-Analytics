# Vakaros Atlas Sailing Analytics

Regatta-Performance-Analyse für Aufnahmen des **Vakaros Atlas 2**. Importiere `.vkx`-
(oder `.csv`-)Dateien und analysiere **Start**, **Manöver** (Wenden/Halsen) und die
**Performance je Schlag**, pflege **Polaren pro Boot** und hinterlege den **Boots-Typ**
als Metadatum. Läuft als statische SPA + PHP/MariaDB-API auf dem Cyon-Webhosting
(`vakaros.tying-the-knot.ch`).

## Aufbau

```
frontend/   Vite + TypeScript + React SPA (Build -> ../public)
  src/parse/     VKX-Binärparser + CSV-Parser -> einheitliches Sample-Modell
  src/analysis/  Wind (hybrid), Manöver, Schläge, Start, Polar  (reine, getestete TS-Logik)
  src/components/ TrackMap (Leaflet), TimeSeries (uPlot), PolarChart (SVG)
  src/views/     Login, Dashboard, Import, SessionView, BoatManager, PolarEditor
api/        PHP-8-Front-Controller + PDO (MariaDB), Session-Auth + CSRF
  db/migrations.sql   Schema (users, boats, polars, sessions)
  bin/create-user.php CLI zum Anlegen eines Logins
public/     Vite-Build-Output + .htaccess (SPA-Fallback + API-Routing + HTTPS)
storage/    gzip-JSON der Tracks (außerhalb Webroot halten)
scripts/    package.sh (Deploy-Bundle), dev-router.php (lokaler Full-Stack-Server)
```

Kerndaten aus dem VKX (Spec: https://github.com/vakaros/vkx): Position/Speed/Orientierung
(Quaternion → Heel/Trim/Heading), Startlinien-Pings, Race-Timer, Wende-Marker und – falls
Instrumente angeschlossen – Wind/Speed-through-Water. Der CSV-Export enthält nur den
abgeleiteten PVO-Kanal.

## Lokale Entwicklung

Voraussetzungen: Node ≥ 20, PHP ≥ 8.1, MariaDB/MySQL.

```bash
# 1) Datenbank
mysql -e "CREATE DATABASE vakaros CHARACTER SET utf8mb4;"
mysql vakaros < api/db/migrations.sql

# 2) Konfiguration
cp .env.example .env           # DB-Zugang + STORAGE_DIR eintragen
mkdir -p storage/tracks
php api/bin/create-user.php you@example.com yourpassword

# 3) Frontend-Abhängigkeiten + Tests
cd frontend && npm install && npm test    # 16 Unit-/Integrationstests

# 4a) Getrennt entwickeln (Hot-Reload):
npm run dev                    # Vite auf :5173, proxyt /api -> :8000
php -S 127.0.0.1:8000 api/index.php    # in einem zweiten Terminal

# 4b) Produktions-Build lokal als Full-Stack testen:
npm run build                  # -> ../public
php -S 127.0.0.1:8000 -t public scripts/dev-router.php   # aus dem Repo-Root
```

## Deployment auf Cyon

Cyon = LiteSpeed + PHP 8.x + MariaDB 10.6, `.htaccess`-kompatibel, Git/SFTP + SSH.

### Automatisch (GitHub Actions, FTPS)

Der Workflow `.github/workflows/deploy.yml` baut das Frontend, lässt die Tests als Gate
laufen und lädt `public/`-Inhalt + `api/` per **FTPS** in den Webroot der Subdomain. Er
läuft bei jedem Push auf `main` sowie manuell (Actions-Tab → *Run workflow*). Dafür müssen
im Repo unter **Settings → Secrets and variables → Actions** vier Secrets gesetzt sein:

| Secret | Inhalt |
|---|---|
| `FTP_SERVER` | Cyon-FTP-Hostname (aus dem Cyon-Panel) |
| `FTP_USERNAME` | Cyon-FTP-Benutzername |
| `FTP_PASSWORD` | Cyon-FTP-Passwort |
| `FTP_SERVER_DIR` | Webroot der Subdomain relativ zum FTP-Home, mit `/` am Ende, z. B. `public_html/vakaros/` |

`.env` und `storage/` werden bewusst **nie** hochgeladen (liegen außerhalb des Webroots und
stehen zusätzlich in der `exclude`-Liste). Die einmalige Server-Provisionierung (Schritte
2–5 unten) bleibt manuell.

### Manuell (Fallback)

```bash
./scripts/package.sh           # Build + Assemblierung nach ./deploy
```

Danach auf dem Server:

1. Inhalt von `deploy/` in den Webroot der Subdomain hochladen
   (enthält `index.html`, `assets/`, `.htaccess`, `api/`).
2. `.env` **eine Ebene über** dem Webroot anlegen (DB-Zugang aus dem Cyon-Panel) und ein
   beschreibbares `storage/`-Verzeichnis **außerhalb** des Webroots (`STORAGE_DIR`).
3. Datenbank im Panel anlegen, `api/db/migrations.sql` importieren (phpMyAdmin oder SSH).
4. PHP-Version im Panel auf 8.x setzen; Let's-Encrypt-HTTPS aktivieren.
5. Login anlegen: `php api/bin/create-user.php <email> <passwort>` (per SSH).

Die `.htaccess` erzwingt HTTPS, routet `/api` auf den Front-Controller und liefert für
alle anderen Pfade `index.html` aus (SPA-Routing).

## Wind & Grenzen

Der Atlas 2 zeichnet ohne externe Instrumente **keinen Wind** auf. Das Wind-Modell ist
hybrid: Instrumentendaten aus der `.vkx` werden genutzt wenn vorhanden, sonst wird die
Windrichtung (TWD) aus den Wende-Markern bzw. der Track-Geometrie **geschätzt** und die
Windstärke (TWS) manuell eingegeben. Die Schätzung ist ein Startwert – im Import und in
der Session kann TWD/TWS jederzeit korrigiert werden, worauf sich Schlag-Klassifikation
und Polar-Vergleich neu berechnen. Die Schwellwerte der Manöver-/Schlag-Erkennung
(`frontend/src/analysis/maneuvers.ts`) sind bewusst konservativ und feldjustierbar.
