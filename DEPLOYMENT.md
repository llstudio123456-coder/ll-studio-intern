# Deployment — LL Studio Inspector (intern)

Diese Anleitung bringt das Tool über eine öffentliche URL online, **ohne dass Inhalte öffentlich sichtbar sind**.

---

## 0. Warum kein Vercel?

Kurz und ehrlich, damit die Entscheidung nachvollziehbar bleibt:

| Baustein | Warum Serverless nicht geht |
|---|---|
| **Playwright/Chromium** | URL-Analyse, Website-Scores, Screenshots, Kundenfinder-Analyse und der 1:1-Klon starten echtes Chromium. Analysen dauern 8–30 s, ein Suchlauf bis zu 15×. Das sprengt Serverless-Limits. |
| **SQLite + `.data/*.json`** | Kunden, Pipeline, Dubletten-Schutz, Reports, Prompts liegen auf der Platte. Serverless-Dateisysteme sind flüchtig → **Daten wären nach jedem Deploy weg**. |

Auch mit Vercel + Supabase bräuchte man **zusätzlich** einen dauerhaft laufenden Node-Host für Playwright. Deshalb: ein Node-Host, fertig.

> **Wichtigste Regel:** Ohne gemountetes Volume auf `LLI_DATA_DIR` verlierst du bei jedem Deploy alle Daten.

---

## 1. Voraussetzungen

- GitHub-Repository mit diesem Projekt
- Google-Konto (für OAuth)
- Account bei **Railway** oder **Render**

> Persistente Volumes gibt es nur in bezahlten Plänen (Render Starter ≈ 7 $/Monat, Railway ab ≈ 5 $/Monat). Der kostenlose Plan verliert die Daten — nicht nutzbar.

---

## 2. Secrets erzeugen

```bash
npx auth secret          # oder: openssl rand -base64 33
```
Ergebnis ist `AUTH_SECRET`. **Niemals** ins Repo.

---

## 3. Google OAuth einrichten

1. [Google Cloud Console](https://console.cloud.google.com/) → Projekt anlegen
2. **APIs & Dienste → OAuth-Zustimmungsbildschirm**: „Intern" (falls Workspace) oder „Extern"
3. **Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID → Webanwendung**
4. **Autorisierte Redirect-URIs** eintragen:
   ```
   http://localhost:3000/api/auth/callback/google
   https://DEINE-URL.up.railway.app/api/auth/callback/google
   ```
5. `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` notieren

> Die Redirect-URI muss **exakt** stimmen (Protokoll, Host, Pfad). Bei späterer eigener Domain: neue URI **ergänzen**, alte erst danach entfernen.

---

## 4. Deployment auf Railway (empfohlen)

1. **New Project → Deploy from GitHub repo** → dieses Repo
2. Railway erkennt die `Dockerfile` automatisch (`railway.json` ist hinterlegt)
3. **Volume anlegen:** Service → *Variables/Settings* → **Volumes** → **Mount path: `/data`**
4. **Variables** setzen (siehe Abschnitt 6)
5. **Settings → Networking → Generate Domain** → du bekommst z. B. `ll-intern.up.railway.app`
6. Diese URL in `AUTH_URL` eintragen **und** als Google-Redirect-URI ergänzen (Abschnitt 3.4)
7. Redeploy

### Alternative: Render
1. **New → Blueprint** → Repo wählen (`render.yaml` wird gelesen: Docker, Disk `/data`, Healthcheck `/login`)
2. Secrets im Dashboard eintragen (im Blueprint stehen sie als `sync: false`)
3. URL z. B. `ll-studio-inspector.onrender.com`

---

## 5. Datenbank & Migrationen

**Nichts zu tun.** Die SQLite-Datenbank (`$LLI_DATA_DIR/kundenfinder.db`) und alle Tabellen werden beim ersten Zugriff **automatisch** angelegt und migriert (`db.ts` → `migrate()` / `migrateV2()`, idempotent). Es gibt keinen separaten Migrationsschritt.

Vorhandene lokale Daten übernehmen: den Inhalt von `./.data` in das Volume kopieren (Railway: `railway run`/SSH, Render: Shell).

---

## 6. Umgebungsvariablen

| Variable | Pflicht | Wert |
|---|---|---|
| `NODE_ENV` | ✅ | `production` |
| `LLI_DATA_DIR` | ✅ | `/data` — **muss auf das Volume zeigen** |
| `AUTH_SECRET` | ✅ | Wert aus Abschnitt 2 |
| `AUTH_URL` | ✅ | `https://ll-intern.up.railway.app` |
| `AUTH_TRUST_HOST` | ✅ | `true` (Proxy) |
| `GOOGLE_CLIENT_ID` | ✅ | aus Google Cloud |
| `GOOGLE_CLIENT_SECRET` | ✅ | aus Google Cloud |
| `ALLOWED_GOOGLE_EMAILS` | ✅¹ | Kommaliste, z. B. `chef@ll-studio.de,mitarbeiter@ll-studio.de` |
| `ALLOWED_GOOGLE_DOMAIN` | ⬜¹ | z. B. `ll-studio.de` (ganze Workspace-Domain) |
| `INITIAL_ADMIN_EMAILS` | ✅ | wer beim ersten Login **admin** wird |
| `OPENAI_API_KEY` | ⬜ | nur für die KI-Vorschau |

¹ Mindestens **eines** von beiden setzen — sonst kommt niemand rein (Default-Deny ist Absicht).

> Alle Werte gehören ins Dashboard des Hosters, **nie** in Dateien im Repo. `.env` und `.env.local` sind in `.gitignore`.

---

## 7. Erster Start: Owner freischalten & Sicherheitscode setzen

Der Zugriff ist **doppelt** geschützt: Google-Login **und** ein interner Sicherheitscode (Argon2id-Hash, nie Klartext).

1. `https://DEINE-URL/` öffnen → Weiterleitung auf `/login`
2. **Mit Google anmelden** — nur E-Mails aus `ALLOWED_GOOGLE_EMAILS` / `ALLOWED_GOOGLE_DOMAIN` kommen durch; alle anderen landen auf `/access-denied`, ohne interne Daten zu sehen
3. Danach Weiterleitung auf `/gate` → **Sicherheitscode einrichten**
   - mindestens 10 Zeichen, Buchstaben **und** Zahlen
   - schwache Codes (`123`, `password`, `admin`, …) werden **abgelehnt**
   - wird nur als Argon2id-Hash gespeichert

> **Production ist gegen Test-Codes gesperrt:** Ein lokal gesetzter Dev-Code (`isDevelopmentPassword`) wird in Production **hart verweigert** (`gate.ts` → `refuseInProd`). Das Passwort `123` kann online also nicht funktionieren.

### Lokal (Entwicklung)
```bash
npm run setup:dev-access-password          # setzt einen als „Dev" markierten Code
npm run setup:dev-access-password "meinCode123"
```
Dieser Code funktioniert **ausschließlich** lokal.

---

## 8. Weitere Mitarbeiter einladen

1. E-Mail in `ALLOWED_GOOGLE_EMAILS` ergänzen (oder `ALLOWED_GOOGLE_DOMAIN` nutzen) → Redeploy
2. Person meldet sich mit Google an und gibt den internen Sicherheitscode ein
3. Rollen: Wer in `INITIAL_ADMIN_EMAILS` steht, wird `admin`; alle anderen `member`. `/settings` ist **nur für `admin`**.

Zugriff entziehen: E-Mail aus `ALLOWED_GOOGLE_EMAILS` entfernen → Redeploy. Beim nächsten Session-Check ist die Person draußen.

---

## 9. Später: eigene Domain (z. B. `intern.ll-studio.de`)

Es ist **nichts hart codiert** — nur drei Stellen anpassen:

1. **Hoster:** Domain hinzufügen, CNAME laut Anleitung setzen
2. **Google Cloud:** Redirect-URI `https://intern.ll-studio.de/api/auth/callback/google` **ergänzen**
3. **Env:** `AUTH_URL=https://intern.ll-studio.de` → Redeploy

Reihenfolge einhalten: erst Domain aktiv + Redirect-URI ergänzt, dann `AUTH_URL` umstellen — sonst schlägt der Login kurzzeitig fehl.

---

## 10. Sicherheitsmodell (Ist-Zustand)

- **Default-Deny:** `middleware.ts` schützt **alles** außer `/login`, `/gate`, `/access-denied`, `/api/auth`
- **API ohne Session → 401 JSON**, kein HTML-/Datenleck; kein Ausblenden nur im Frontend
- **Zwei Stufen:** Google-Session **und** Gate-Cookie (an die User-ID gebunden)
- **Rollen serverseitig:** `/settings` nur `admin`
- **Session:** 30 min Inaktivität, 8 h absolut
- **Secrets** nur in Umgebungsvariablen, Sicherheitscode nur als Argon2id-Hash

Prüfen:
```bash
npm run typecheck
npm run build
TEST_AUTH_BASE=https://DEINE-URL npm run test:auth
```

---

## 11. Bekannte Grenzen

- **Volume ist Pflicht** — ohne Disk sind die Daten nach jedem Deploy weg
- **Kaltstart:** Chromium-Image ist groß; der erste Request nach dem Deploy dauert länger
- **`npm run build` nie bei laufendem Dev-Server** — überschreibt `.next`, der Dev-Server liefert danach 500
- **Backups:** SQLite liegt auf dem Volume; regelmäßig `$LLI_DATA_DIR` sichern (Hoster-Backup oder Kopie von `kundenfinder.db`)
