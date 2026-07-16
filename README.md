# LL Studio Inspector (Web)

Deploybare **Web-App** für **Kundenanalyse, Konkurrenzanalyse & Website-Inspiration** von LL Studio.
Zwei Modi:

1. **URL Analyse** – Kunden-Webseite eingeben → Analyse + passende Mitbewerber/Inspiration.
2. **Inspiration Suche** – Freitext **oder** geführte Kategorien (Branche · Stil · Ziel · Funktionen · Region) → die besten, ästhetischen Webseiten der Branche.

Recherche läuft **lokal über einen echten Browser (Playwright)** – **keine** Such-API nötig.
Such-APIs (Brave/SerpAPI/Tavily) und KI (Claude/OpenAI/Ollama) sind **optional** und verbessern nur Qualität/Tempo.

> **Nur als Inspiration verwenden. Keine Inhalte, Bilder, Logos oder Designs 1:1 kopieren.**

Stack: **Next.js 15 · React · TypeScript · Tailwind v4 · Playwright**.

---

## Schnellstart

```bash
npm install      # Abhängigkeiten + Chromium für Playwright
npm run dev      # Entwicklung → http://localhost:3000
```

Production:

```bash
npm run build
npm start        # startet den Server (Standard-Port 3000)
```

> `npm install` lädt per `postinstall` automatisch Chromium. Falls übersprungen: `npx playwright install chromium`.

---

## Bedienung

- **Inspiration Suche → Schnellsuche:** große Suchleiste + Vorschlag-Chips („Restaurant ästhetisch“, „Zahnarzt premium“ …).
- **Inspiration Suche → Geführte Suche:** Schritt 1 Branche, 2 Stil, 3 Ziel, 4 Funktionen, 5 Region → „Suche starten“.
  Klicks bauen automatisch smarte Suchanfragen (DE + EN + Awwwards/Webflow/Framer).
- Aktive Filter erscheinen als entfernbare Chips. Ergebnisse lassen sich nach Score/Ästhetik/Modernität/Struktur/Mobile/Inspiration/Relevanz **sortieren** und nach Branche/Stil/Score **filtern**.
- Pro Treffer: Screenshot, Score, Stil, Farben, „warum passend“, Ideen für LL Studio, Copy-Warnung, Detailansicht, Unterseiten, Funktionen.
- Gemeinsamer **Inspirations-Report** + Export **JSON / CSV / PDF**. Alles unter **Reports** gespeichert.

### URL-Eingabe & Branchen-Gate (nur passende Branche)
Gibt man in der **Inspiration Suche** eine **Website-URL** ein (z. B. `https://www.leon-pulheim.de/`), wird die Seite
zuerst analysiert und ihrer **Branchenfamilie** zugeordnet (z. B. *Restaurant / Gastronomie*). Daraus entstehen gezielte
**weltweite** Suchanfragen. Jeder Treffer durchläuft eine **harte Branchen-Prüfung** und erscheint nur, wenn er wirklich
zur Zielbranche gehört. Konsequent **abgelehnt**: fremde Branchen (Autohaus, Handwerk, Immobilien, Museen …),
Plattform-/Social-/Musik-/Verzeichnisseiten (Spotify, YouTube, Instagram, Booking, Yelp …), Website-Builder & Showcases
(Awwwards, Webflow, Framer, Squarespace, Wix …), „Best-X-Websites“-Artikel/Listen und Agenturen/Restaurant-SaaS.
**Qualität vor Quantität** – lieber 3 echte Restaurant-Webseiten als 20 unpassende; ausgeblendete Treffer stehen mit
Ablehnungsgrund in einer aufklappbaren Debug-Liste, über der Ergebnisliste erscheinen erkannte Branche + Suchmodus.
Passt die Erkennung nicht, Branche einfach über Kategorien/Freitext manuell überschreiben.

### „Weltweite Inspiration“ vs. „direkte Mitbewerber“
**Inspiration Suche** sucht weltweit die besten, optisch stärksten Webseiten der Branche (Design-Vorbilder).
**URL Analyse** findet eher lokale/regionale **direkte Mitbewerber** zur eingegebenen Kundenseite.

### Wenn die Suche blockiert (Captcha / keine Treffer)
Die App zeigt die generierten Suchanfragen mit **„im Browser öffnen“**-Buttons. Passende Webseiten kopieren und als
**manuelle URL** einfügen – sie werden automatisch analysiert. Alternativ einen Such-API-Key in **Settings** hinterlegen.

---

## Deployment

Die App nutzt Playwright **serverseitig** (Browser-Automatisierung + Screenshots + PDF). Sie braucht daher eine
**Node.js-Laufzeitumgebung** (kein reines Static/Edge-Hosting).

**Empfohlen:** Node-Host wie **Railway, Render, Fly.io, ein VPS oder Docker**.

```bash
npm install
npm run build
npm start          # bedient z. B. Port 3000
```

- Persistenz (Reports, Screenshots, Settings) liegt unter `./.data/`. Für dauerhafte Speicherung ein **persistentes Volume** auf `./.data` mounten (oder `LLI_DATA_DIR` auf einen beschreibbaren Pfad setzen).
- **Docker-Hinweis:** Basis-Image mit Browser-Abhängigkeiten verwenden, z. B. `mcr.microsoft.com/playwright:v1.49.1-jammy`, dann `npm ci && npm run build && npm start`.
- **Vercel:** Das Standard-Serverless-Setup eignet sich **nicht** für Playwright-Screenshots. Für Vercel stattdessen einen Such-API-Key (Brave/SerpAPI/Tavily) nutzen und die Browser-Schritte auf einem externen Worker betreiben. Für den normalen Betrieb einen Node-Host wählen.

---

## API-Keys (alle optional)

`.env.example` → `.env` kopieren **oder** alles bequem in der App unter **Settings** eintragen (wird in `./.data/settings.json` gespeichert).

```env
AI_API_KEY=
AI_PROVIDER=        # anthropic | openai | ollama
AI_MODEL=
SEARCH_PROVIDER=    # auto | brave | serpapi | tavily | local
BRAVE_API_KEY=
SERPAPI_KEY=
TAVILY_API_KEY=
MAX_RESULTS=20
DEFAULT_COUNTRY=Germany
```

### Ohne Keys (Standard)
Volle Funktion: lokale Browser-Suche (Startpage/Bing/DuckDuckGo), Branchen-/Stil-/Farb-Erkennung, Screenshots,
Scoring, Ideen, Report, Export.

### Mit Such-API-Key
Stabilere/schnellere Treffer, kein Browser-Blocking. Reihenfolge wird über `SEARCH_PROVIDER` gesteuert
(`auto` = API falls vorhanden, sonst lokaler Browser).

### Mit KI
Treffsicherere Design-Empfehlung, natürlichere Texte und Lernpunkte im Report.

---

## KI-Vorschau-Provider & API-Keys (sicher)

> **API-Keys werden NICHT automatisch aus ChatGPT, Browsern oder Accounts gezogen.** Du trägst sie **bewusst selbst** in `.env.local` (oder eine sichere Server-Umgebung) ein. Die App nutzt sie **nur serverseitig** und zeigt sie **niemals** im Frontend, in Logs, in Debug-Ausgaben, in Fehlermeldungen, in gespeicherten Projekten oder in exportierten Prompts an.

Die **KI-Vorschau** (in der Stil-Vorschau) kann optional einen Provider nutzen, um aus dem erzeugten Prompt echten HTML/React-Code zu bauen. Ohne Key funktioniert **immer** der manuelle Prompt-Export (kopieren / `.txt`).

### Keys eintragen

Lege eine Datei **`.env.local`** im Projektstamm an (steht in `.gitignore`, wird nie committet):

```env
# KI-Vorschau-Provider – ALLE optional. Leer lassen = manueller Export.
V0_API_KEY=
V0_MODEL=
CLAUDE_API_KEY=
CLAUDE_MODEL=
OPENAI_API_KEY=
OPENAI_MODEL=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=
DEFAULT_AI_PREVIEW_PROVIDER=manual   # v0 | claude | openai | ollama | manual
```

Reihenfolge der Quellen: **Prozess-Environment > `.env.local` > `.env` > App-Settings**. Danach den Dev-Server neu starten.

### Provider ohne Key
Fehlt der Key, stürzt nichts ab – die App bietet automatisch den **manuellen Prompt-Export** an: *„Kein API-Key hinterlegt. Du kannst den Prompt manuell kopieren.“*

### Ollama lokal nutzen
Ollama braucht **keinen API-Key**. Starte Ollama lokal (`ollama serve`, Modell z. B. `ollama pull llama3.1`), setze `OLLAMA_BASE_URL`/`OLLAMA_MODEL`. Ist der Server nicht erreichbar, erscheint: *„Ollama ist nicht erreichbar. Bitte Ollama starten oder anderen Provider wählen.“* Hinweis: lokale Modelle können schwächere Designs erzeugen als spezialisierte UI-KIs.

### Provider testen
In der KI-Vorschau: Provider wählen → **„Provider testen“**. Es läuft eine minimale Server-Anfrage (kosten-neutraler `/models`- bzw. Ollama-`/api/tags`-Aufruf) und zeigt **nur** Erfolg/Fehler (*Key gefunden · Key fehlt · Provider nicht konfiguriert · Ollama nicht erreichbar*) – **niemals** der Key oder rohe sensible Antwortdaten. Die Status-Zeile zeigt nur **verfügbar**, **Key vorhanden ja/nein** und **Modellname**.

### Sicherheit (Kurzfassung)
- Keys nur aus `.env.local` / `.env` / Server-Env / sicherer Settings-Speicherung.
- Kein Key im Client-Bundle, in React-Komponenten, Logs, Debug, Fehlermeldungen, Projektdaten oder Export-Prompts.
- `.env` und `.env.local` sind in `.gitignore`; `.env.example` enthält nur leere Platzhalter.
- Zentrale Helfer: `maskSecret` (zeigt nur „Key vorhanden“), `getServerProviderConfig` (server-only, inkl. Key), `validateProviderConfig`, `getPublicProviderStatus` (ohne Secrets).
- **Falls versehentlich ein Key geleakt wurde (z. B. in einen Chat kopiert): sofort beim Anbieter widerrufen/rotieren.**

---

## Logos

Logo liegt unter `public/logo/LL-logo-trim.png` (+ `LL-logo.png`). Echte LL-Studio-Logos einfach gleichnamig
überschreiben (PNG, transparent). Fehlt die Datei, zeigt die App ein dezentes SVG-Monogramm. Palette: Paper/Ink/Gold.

---

## Projektstruktur

```
src/
  app/                      Next.js App Router
    page.tsx                Dashboard
    url-analyse/            Modus 1: URL-Analyse
    inspiration/            Modus 2: Inspiration-Suche (Schnellsuche + Wizard)
    reports/  settings/
    api/                    Route Handler (Node-Runtime):
      analyze-url/          SSE-Stream URL-Analyse
      inspiration-search/   SSE-Stream Inspiration-Suche
      shot/ export/ projects/ settings/ status/
  components/               React-UI (Cards, Detail, Report, Wizard, Filter …)
  lib/                      Client-Helfer (SSE-Runner, Formate, Kategorien)
  shared/types.ts          gemeinsame Typen
  server/                   serverseitige Logik (Playwright/Heuristiken)
    services/
      providers/            SearchProvider-System: brave, serpapi, tavily,
                            localBrowser, registry  (+ ManualProvider via Fallback)
      extract / scorer / industry / targetAnalyzer / competitorAnalyzer
      queryGenerator / queryExpansion / searchEngine
      urlPipeline / inspirationSearch / inspiration / ai / storage / exporter / config
    utils/                  logger, url, paths
.data/                      lokale Laufzeitdaten (Projekte, Screenshots, Settings) – gitignored
```

Zentrale Typen: `TargetWebsiteAnalysis`, `CompetitorCandidate`, `CompetitorAnalysis`, `WebsiteScore`,
`InspirationReport`, `SearchQuery`, `ManualUrlInput`, `LocalBrowserSearchResult`,
`InspirationSearchConfig`, `InspirationSearchProject`, `ProviderRawResult`.

---

## Prompt Generator

Aus einer guten Inspirations-Website einen **fertigen deutschen Prompt** für ein neues Kundenprojekt erzeugen
(für Claude Code, Lovable, Cursor, allgemeine Builder, HTML/CSS/JS oder Next.js/Tailwind).

**So geht's:**
1. In **Inspiration Suche** oder **URL Analyse** bei einer Webseite auf **„Prompt erstellen“** / **„Als Stilvorlage nutzen“** klicken
   → öffnet den **Prompt Generator** mit der Website als Vorlage A.
   (Alternativ im Generator eine URL manuell einfügen oder aus gespeicherten Reports wählen.)
2. **Zielunternehmen B** eintragen (Name, Branche, Standort, Leistungen, Zielgruppe, Ziel, gewünschte Seiten, Notizen, Logo/Assets).
   Optional: „Bestehende Website analysieren“ → Stärken/Schwächen fließen in den Prompt ein.
3. **Prompt-Typ** (komplette Website, Startseite, Landingpage, Redesign, Inhalt+Struktur, Design-System) und **Zielplattform** wählen.
4. **„Prompt erzeugen“** → Vorschau mit Zusammenfassung (Vorlage, Ziel, Stilrichtung, empfohlene Seiten, Haupt-CTA, Warnungen).

**Prompt nutzen:** direkt im Editor anpassen, dann **kopieren**, **als .txt speichern** oder **im Projekt speichern**
(Zuordnung zu einem Report-Projekt möglich). Gespeicherte Prompts liegen unter **Prompt Generator → Gespeicherte Prompts**
(`.data/prompts/`).

**Wichtig (in jedem Prompt enthalten):** Die Referenz dient **nur als Inspiration** – der Prompt weist die KI ausdrücklich an,
**keine** Texte, Bilder, Logos, Marken, Farben 1:1, Code oder Layouts zu kopieren, sondern ein **eigenständiges** Design für
Unternehmen B zu erstellen. Fehlende Infos werden als gekennzeichnete Platzhalter eingesetzt (keine erfundenen Geschäftsdaten).

Ohne KI funktioniert der Generator vollständig (regelbasierte Vorlagen). Mit konfigurierter KI wird der Wortlaut zusätzlich
sprachlich veredelt (Struktur & Rechtshinweise bleiben erhalten).

## Stil-Vorschau (Design Preview)

Zeigt, wie **Kunde A** im allgemeinen Stil einer starken Referenz **B** aussehen könnte – als **eigenständiges Konzept**,
kein Klon. Es wird eine echte, editierbare HTML-Startseite im Browser gerendert (kein bloßes Bild).

**So geht's:**
1. In **Inspiration Suche** / **URL Analyse** bei einer Webseite auf **„Vorschau mit diesem Stil“** bzw. in der Detailansicht
   **„Stil auf Kundenprojekt anwenden“** klicken → öffnet die **Stil-Vorschau** mit B als Stilvorlage.
   (In **Reports** öffnet **„Design-Vorschau erstellen“** die Vorschau mit dem Projekt als Kunde A.)
2. **Kunde A** eintragen: Name, URL, Branche, Standort, Leistungen, Zielgruppe, **Marken-Farben** und **Logo hochladen**
   (oder „aus Projekt laden“). Optional „Bestehende Website analysieren“ (Farben/Inhalte/Schwächen automatisch).
3. **Vorschau generieren** → das Stilprofil von B (Layout, Spacing, Ecken, Cards, Typografie, Farbstimmung) wird auf
   A übertragen, **A behält Identität** (Name, Logo, Farben, Inhalte). „Neu generieren“ erzeugt Varianten.

**Ansichtsmodi:** Desktop · Mobil · **Vorher/Nachher** (Original A vs. Konzept) · **Referenz** (B-Screenshot + Stilprofil).

**Inline bearbeiten:** Button **„Texte bearbeiten“** → in der Vorschau direkt auf Überschriften, Texte und Buttons klicken
und überschreiben. Die Änderungen fließen automatisch in PNG/HTML-Export, Speichern und „Prompt aus Vorschau“ ein.

### Stil-Matching (so wird die Referenz wirklich getroffen)
Die Vorschau folgt der **Designsprache** der Referenz – nicht einem generischen Template. Dafür wird ein **Archetyp**
erkannt und ein vollständiges Stilprofil abgeleitet:
- Archetypen u. a.: **dark-cinematic-restaurant**, light-premium-restaurant, luxury-service, minimalist-agency,
  automotive-premium, craftsman-trust, medical-clean, modern-local-business, generic.
- Pro Archetyp werden Hero-Typ, Hintergrund (dunkel/hell/creme), Overlay, Navigationsposition, Typografie (Serif/Sans),
  Eckenradius, Spacing, Bild-Intensität, Akzentfarbe und Sektionsreihenfolge gesetzt. Die Vorschau nutzt echte
  CSS-Tokens (`--preview-bg`, `--preview-text`, `--preview-accent`, `--preview-heading-font`, `--preview-overlay`, …).
- Für ein Restaurant wie **Mi-Da** entsteht z. B. ein **dunkler, cinematischer** Auftritt: Vollbild-Hero mit Food-Bild
  und dunklem Overlay, Navigation über dem Hero mit prominentem Logo, große Serif-Headline, kleines letter-spaced
  Eyebrow, CTA „Tisch reservieren“, untere Reservierungsleiste, Food-Galerie und Speisekarten-Sektion – **keine** weißen
  SaaS-Layouts, **keine** blauen Buttons, **keine** grauen Platzhalter-Boxen (Bilder = elegante dunkle Verläufe mit Label).

### Reference Blueprint (echte Analyse statt Templates)
Hat Referenz B eine **URL**, wird sie beim Generieren **live per Browser analysiert** (DOM-Analyse) und daraus eine
**Reference Blueprint** gebaut: Hero-Typ (Vollbild/Split/zentriert), Overlay & Text-Platzierung, Navigationsposition
(über dem Bild / Top-Leiste), Logo-Position, Reservierungs-CTA im Header, Slider/Scroll-Indikator, Hell/Dunkel-Charakter,
Serif/Sans, Ecken-Radius, Bilddominanz und Sektionsrhythmus. **Die Blueprint bestimmt das Vorschau-Layout** – Templates
sind nur noch die Basis/Fallback (Fallback wird gemeldet: „Referenz konnte nicht vollständig analysiert werden“).

Harte Regeln: Vollbild-Hero in B → Vollbild-Hero in der Vorschau (mit **Kunde-A-Bild**); Nav über dem Bild in B → ebenso
in der Vorschau; Reservierungs-Button in B → „Tisch reservieren“ in der Vorschau; bildstarke Referenz → bildstarke Vorschau.
Farben kommen weiterhin von **Kunde A** (je nach Farbmodus), die Struktur von B.

Ein **Blueprint-Treue-Score (0–100)** misst, wie genau die Vorschau der echten Referenz-Struktur folgt (unter 80 → Warnung
+ Button „Referenzstruktur stärker übernehmen“). Bei gültiger Blueprint ersetzt er den geschätzten Style-Match. Buttons:
**Aus Referenz neu analysieren** (Blueprint neu bauen) und **Kundenfarben erzwingen** (Palette sofort remappen, Layout bleibt –
die Blueprint wird dabei gecacht, B wird nicht erneut geladen). Der **Style-Debug** zeigt die komplette Blueprint.

**Verifiziert (Kunde A = Leon):** Referenz `cafe-feynsinn.de` → helle Seite, Vollbild-Hero mit Leon-Foto, Nav über dem Bild,
Reservierungs-CTA, Blueprint-Treue 100; Referenz `mida-restaurant.de` → dunkle Seite mit Split-Hero und Top-Nav –
klar unterschiedlich, beide mit Leons grünem CTA.

### Kundenfarben sind IMMER Standard (Farbmodus entfernt)
Der frühere Farbmodus (Referenzfarben behalten / als Akzent / stark / nur Kundenpalette / auto) ist entfernt – er war
verwirrend und führte zu falschen Paletten. **Neue feste Regel:**
- **Kunde A bestimmt immer die finalen Farben.** Referenz B bestimmt nur **Struktur & Farb-ROLLEN**
  (dunkle Nav-Rolle → dunkelster Kunden-Ton, helle Fläche → Kunden-Creme, Akzent-Rolle → Kunden-Akzent, weißer Button →
  helle Kunden-Neutrale). Referenzfarben landen **nie** in den finalen CSS-Variablen.
- Farben von Kunde A kommen aus dem **Website-Code** (CSS-Variablen, computed Styles von Header/Nav/Buttons/CTA/Footer),
  dann Logo, Screenshot nur als Stütze. Priorität: manuell → gesperrte Palette → Website-CSS/Styles → Logo → Fallback.
- Findet die App **gar keine** Kundenfarben, nutzt sie eine neutrale Fallback-Palette, kennzeichnet das klar und
  **blockiert** „bereit für Kundenvorschau“, bis Farben gesetzt/bestätigt sind.
- Panel **„Kundenfarben“**: erkannte Palette mit HEX/Quelle/Rolle/Confidence, **„Farben aus Kunde A neu erkennen“**,
  **Palette manuell korrigieren** (Color-Picker) und **„Palette sperren“** (Regenerieren überschreibt nie eine gesperrte Palette).
- Ein strikter Check schlägt an, wenn die finale CTA-Farbe näher an Referenz B als an Kunde A liegt → Warnung + blockiert.

### Validierte Scores & Kundenpaletten-Erzwingung (keine Fake-Werte)
Alle Scores werden aus **messbaren Prüfungen** berechnet, nicht aus Einstellungen:
- **Style Match** = Blueprint-Treue (echte DOM-Prüfung der Referenz-Struktur). Ohne Referenz-URL/Blueprint: **max. 70**
  mit Hinweis „nicht vollständig geprüft“. Bei Fallback ebenfalls max. 70 („Fallback genutzt …“).
- **Brand Match** = tatsächliche **Paletten-Genauigkeit** (Hintergrund per RGB-Nähe, CTA per **Farbton-Nähe** zum
  Kundenpool – Lesbarkeits-Abdunklung zählt nicht als Abweichung) + echt genutztes Logo/Bilder. Im Kundenfarben-Modus mit
  Genauigkeit < 85: **max. 70** und „bereit für Kundenvorschau“ blockiert.
- **Client Presentable** = Struktur-Treue + Kontrastmessung + Bild-Fit + Platzhalter-Anteil.
- Optisch schwach bewertete Referenz (< 75) blockiert „ready“, außer man erzwingt sie über
  **„Referenzstruktur stärker übernehmen“** (dann klar gekennzeichnet).
- Der **Style-Debug** zeigt je Score die Begründung („» Style 100: Blueprint-Treue …“) und **je CSS-Token die Quelle**
  (z. B. `--preview-bg: Kunde A (website) → hellster Markenton`).

**„Nur Kundenpalette“** mappt jetzt wirklich ALLE Token-Werte aus Kunde A: Referenz B liefert nur die **Rollen**
(dunkle Nav → dunkelster Kunden-Ton, helle Fläche → Kunden-Creme, Akzent-Rolle → Kunden-Akzent). Ein strikter Check
blockiert „ready“, wenn im Kundenmodus trotzdem Referenzfarben in den finalen Werten landen.
**„Kundenfarben erzwingen“** löst eine bestehende Palettensperre und remappt sofort auf die Kundenpalette (Layout bleibt,
Blueprint ist gecacht). Verifiziert (Leon + Café Feynsinn, „Nur Kundenpalette“): Feynsinn-Struktur (Vollbild-Hero, Nav über
Bild) mit Leons Creme-Hintergrund und Sage-grünem CTA – Genauigkeit 91, ready nur weil die Prüfungen real bestehen;
Gegenprobe „Nur Referenzstil“ ergibt ehrlich niedrige Brand-Werte (41, nicht ready).

### Referenz-spezifische Generierung (verschiedene Referenz = anderes Layout)
Früher erzeugten unterschiedliche Referenzen fast dieselbe Vorschau, weil nur zwei grobe Archetypen genutzt wurden.
Jetzt wird aus **Referenz B** ein **Style-Fingerprint** berechnet (Dunkelheit, Wärme, Sättigung, Eleganz, Minimalismus,
Cinematic, Bild-Anteil) und daraus ein **Template** gewählt:
**dark-cinematic · gallery-driven · light-editorial · elegant-split · minimal-luxury · modern-minimal · warm-local.**
Das Template bestimmt Hero-Typ, Navigation, Typografie (Serif/Sans), Spacing, Eckenradius, Hintergrund (hell/dunkel/creme),
Overlay, Bildbehandlung und **Sektionsreihenfolge** – deshalb ändert sich das gesamte Seitenkonzept, nicht nur Farben/Texte.
Bei Referenzwechsel wird der alte Entwurf verworfen und komplett neu generiert.

**Sichtbar unterschiedlich (getestet, Kunde A = Leon, grüne Marke):**
- helle elegante Referenz → *elegant-split* (Split-Hero, hell, Serif)
- dunkle cinematische Referenz → *dark-cinematic* (Vollbild-Hero, dunkel, Serif, Overlay)
- modern-minimale Referenz → *minimal-luxury* (zentriert, hell, Sans, scharfe Kanten)
– in allen Fällen mit Leons **grünem CTA/Akzent**.

**Zu ähnlich?** Buttons: **Referenzstil stärker erzwingen · Neue Komposition erzeugen · Frisches Layout (nicht
wiederverwenden)**. Ein **Layout-Einzigartigkeits-Score** warnt, wenn eine neue Referenz trotzdem dieselbe Signatur ergibt.
Der **Style-Debug** (aufklappbar) zeigt Referenz-URL, Archetyp, gewähltes Template, Fingerprint-Werte, Layout-Signatur,
Palette-Quelle/Sperre und finale Tokens.

### Style Match Score
Ein Wert **0–100** zeigt, wie nah die Vorschau die Referenz trifft (Farb-Stimmung, Archetyp, Typografie, Hero-Komposition,
CTA, Navigation, Bildnutzung, Branchen-Stimmung). **Ab 80** gilt die Vorschau als „trifft die Referenz gut“. Darunter
erscheint der Hinweis *„Die Vorschau trifft die Referenz noch nicht stark genug …“* – und der Generator versucht
automatisch eine stärkere Variante.

### Manuelle Stil-Regler
Über der Vorschau: **Archetyp**-Auswahl plus Buttons **Stil stärker übernehmen · Mehr Referenz-Look · Mehr Kundenbranding ·
Dunkler · Heller · Mehr Bilder · Luxuriöser · Moderner · Weniger generisch**. Jede Anpassung generiert sofort neu.
Das **Referenz-/Stilprofil-Panel** zeigt Archetyp, Farben, Typografie, Hero-Typ, CTA-Stil und Layout-Notizen.

### Brand-/Farb-Transfer (Stil von B + Marke von A)
Die Vorschau kombiniert **Stil von Referenz B** mit dem **Branding von Kunde A**:
- **Markenfarben von A** werden automatisch ermittelt – Priorität: manuelle HEX > Logo-Farben > Website-Farben.
  Logo-Farben werden beim Upload direkt im Browser aus dem Logo extrahiert (ist das Logo grün, wird die Vorschau grün).
- Ein **Farb-Mapping** legt A-Farben sinnvoll auf die Stilstruktur von B: B-Hintergrund/Hell-Dunkel bleibt, der
  Akzent/CTA wird mit A's Markenton gemischt – Kontrast & Premium-Lesbarkeit bleiben erhalten (kein „hässliches“ Roh-Recoloring,
  kein Standard-Blau). Beispiel **Leon + Mi-Da**: dunkles cinematisches Restaurant-Layout, aber **grüner Akzent/CTA** statt Gold.
- CSS-Tokens: `--preview-primary/-secondary/-accent/-bg/-surface/-text/-muted/-border/-cta/-cta-hover`.

**Branding & Farben-Panel:** Primär-/Sekundär-/Akzentfarbe (Color-Picker), **Farbmodus** (Kundenfarben priorisieren /
Referenzstil priorisieren / Ausgewogen / Nur Kundenfarben / Nur Referenzstil / Auto), **Branding-Stärke 0–100**,
Hintergrund (hell/dunkel/auto), Live-Palette-Swatches und Buttons *Farben von Kunde A übernehmen · Logo-Farben anwenden ·
Farben aus Logo neu erkennen*.

#### Farbanalyse-Audit (beweisbasiert, mehrseitig)
Die Farberkennung ist eine **Audit-Pipeline** (`/api/color-audit?url=…`): Startseite + bis zu 2 Unterseiten werden
gecrawlt; Farben kommen aus **CSS-Variablen und computed UI-Styles** (Header/Nav/Logo-SVG/Buttons/CTA/Links/Footer/
Sektionsflächen) mit **Fläche, Selektor, Vorkommen und Seitenzahl** als Beweis. Cookie-Banner/Widgets/Maps/Fotos werden
verworfen. Jede Farbe erhält Confidence + Begründung; **nur definierte, aber nie sichtbar genutzte CSS-Variablen** werden
nie automatisch übernommen (so verschwindet z. B. ein ungenutztes Template-Rot/-Blau). Es gibt **kein Farbton-Vorurteil**:
ein echtes Marken-Blau (Header/Nav/CSS-Var, große Fläche) gewinnt – nur Browser-Default-Blau (`#0000ee`-artig, ungestylte
Links) wird hart abgewertet. Rollen (primary/secondary/accent/bg/surface/text/cta) werden aus Belegen zugewiesen;
Hintergrund/Text dürfen neutrale Töne sein, „Marke“ nicht. **Pro Domain wird die bestätigte Analyse gespeichert und
wiederverwendet** (`.data/customer-palettes/`) – „Farben aus Kunde A neu erkennen“ erzwingt eine frische Analyse.
Ist die Erkennung unsicher (keine Farbe ≥ 70 Confidence, nichts manuell/gesperrt), wird die Kundenvorschau **blockiert**:
„Die Markenfarben konnten nicht sicher erkannt werden. Bitte Palette bestätigen.“
Im Panel „Erkannte Kundenfarben“: pro Farbe **P/S/A-Buttons** (als Primär/Sekundär/Akzent setzen), Verwerfen-Toggle und
**manuelle HEX-Eingabe** (höchste Priorität).

Verifizierte Pflichtfälle (`npm run test:pflicht`): `weinhausfledermaus.de` → **Blau `#1875af`** als Primary/CTA (Rot nur
„definiert, nicht genutzt“ → aussortiert); `leon-pulheim.de` → **Grün `#b8cdab`/`#8ec88d` + Creme `#fffdcd`**.

#### Zuverlässige Kundenfarben-Erkennung
Die Markenfarben von Website A werden **nicht** aus Screenshot-Dominanz geraten (sonst landet man bei Weiß/Schwarz/Grau/
Foto-/Cookie-Farben). Stattdessen mehrere Methoden, priorisiert: **1) manuelle HEX** (höchste Priorität) → **2) Logo-Farben**
(beim Upload aus dem Logo extrahiert) → **3) Website-Markenfarben** aus **CSS-Variablen** (`--primary/--brand/--accent/…`)
und **computed Styles** von Buttons/CTA/Navigation/Links/Header/Footer → **4) Referenz B** nur wenn gewählt → **5) Fallback**.
Jede Farbe bekommt eine **Confidence (0–100)**, eine **Quelle** (css-var/button/nav/link/footer/logo/manuell) und einen
**Rollen-Vorschlag** (primary/secondary/accent/background/text/muted). **Gefiltert/abgewertet:** reines Weiß/Schwarz, Grau,
**Default-/generisches Blau** (häufige Framework-/Link-Default-Farbe → wird hinten eingereiht, damit echte Markenfarben wie
Grün/Beige gewinnen), sowie **Cookie-/Widget-/Maps-/Social-Embed-Farben** (bewusst ausgeschlossen). Beim Analysieren wird
zu jeder Seite ein Debug-Log mit allen erkannten Farben, Quelle, Confidence, gewählter/verworfener Farbe ausgegeben.

**Panel „Erkannte Kundenfarben“:** zeigt alle Farben mit Hex, Quelle, Confidence, Rolle und **Ein-/Ausschalter** (Toggle),
plus Buttons *Farben von Website A neu erkennen · Kundenfarben auf Vorschau übertragen · Als Kundenpalette speichern ·
Gespeicherte Palette laden*. Nur Farben mit hoher Confidence werden automatisch übernommen; unsichere werden gezeigt, aber
nicht angewandt. Ist die Erkennung unsicher, erscheint ein Hinweis zur manuellen Bestätigung statt falscher Auto-Farben.

#### Farbmodi, Palette sperren, Projekt-Memory
- **Farbmodi:** *Referenzfarben behalten · Kundenfarben als Akzent · Kundenfarben stark übernehmen · Nur Kundenpalette ·
  Automatisch.* Bei dunklem Cinematic-Stil bleibt der dunkle Premium-Hintergrund, Kundengrün wird Akzent/CTA, Beige/Creme
  werden Flächen/Text – mit gutem Kontrast (nicht das ganze Design wird grün, außer „Nur Kundenpalette“).
- **Palette sperren:** Checkbox „🔒 Palette sperren“ – die bestätigte Palette wird bei jeder Neu-Generierung exakt beibehalten.
- **Projekt-Memory:** „Als Kundenpalette speichern“ legt die Palette pro Projekt ab (`.data/palettes/`); „Gespeicherte Palette
  laden“ holt sie zurück und sperrt sie.
- **Validierung:** Brand-Color-Match, Kontrast-Score und Stil-Erhalt; Warnungen bei zu wenig Kontrast, unsicheren Farben oder
  ignorierten Cookie-Farben. **Farbvergleich**: erkannte A-Farben ↔ Vorschau-Palette ↔ Referenz-B-Farben.

> Beispiel Leon + Mi-Da: erkannt werden Leons **Grün** und **Creme** (Blau aus dem Template wird abgewertet); im dunklen
> Restaurant-Konzept erscheinen **grüner CTA/Akzent** und cremige Flächen – kein blauer CTA, keine Foto-/Cookie-Farben.

### Image-Transfer (echte Bilder von Kunde A)
Hat Kunde A eine Website (Häkchen „Bestehende Website analysieren“), extrahiert die App **echte Bilder** und platziert sie
zweckgerecht: stärkstes Bild in den **Hero**, weitere in **Galerie** und **Über uns**. Bilder werden an den Stil angepasst
(Cover-Crop, bei dunklem/cinematischem Stil dunkles Overlay, Ecken je Stilprofil). Sind keine/zu wenige Bilder vorhanden,
bleiben elegante Platzhalter und es erscheinen Empfehlungen (z. B. „Hero-Bild austauschen“, „Mehr Food-Fotos“). Ein
**Image-Fit-Score** misst die Bildqualität/-passung. Panel **Bilder & Medien**: Bilder-an/aus, „Mehr Bilder“, „Bilder neu zuordnen“.

### Qualitäts-Scores & Kundenvorschau
Drei Scores: **Style Match** (Treue zu B), **Brand Match** (Branding von A), **Client-Presentable** (Eignung für die
Kundenpräsentation, inkl. Bildqualität). „**Bereit für Kundenvorschau**“ ab Style ≥ 80, Brand ≥ 80, Presentable ≥ 85 –
sonst Warnung + Button **„Für Kundenvorschau optimieren“**.

### 3 Konzeptvarianten
Jede Generierung liefert zusätzlich **Referenznah** (mehr B-Stil), **Ausgewogen** und **Markenfokus** (mehr A-Branding) –
per Klick als Hauptvorschau übernehmbar. Ideal für Kundentermine.

### Design-Entscheidung
Ein Block fasst zusammen, **was von Referenz B** (Stil) und **was von Kunde A** (Logo, Marken-Farben, Inhalte, echte Bilder)
kam, wie die Farben angepasst wurden und ob das Konzept präsentationsreif ist. „Prompt aus Vorschau“ übergibt Stilquelle,
Markenquelle, finale Palette, Branding-Stärke, Archetyp und alle Qualitätsnotizen.

### Inspiration, kein Klon
Die Vorschau übernimmt nur die **allgemeine Designsprache** (Mood, Archetyp, Spacing, Typografie-Gefühl, Farbstimmung,
Komponenten-Stil) und füllt sie mit **Kunde As** Name, Logo, Farben und Inhalten. Es werden **keine** Texte, Bilder,
Logos, Codes oder exakten Layouts der Referenz übernommen.

**Exporte & Aktionen:** **Als Bild (PNG)** und **Als HTML** exportieren, **Im Projekt speichern**
(`.data/previews/`), und **„Prompt aus Vorschau erstellen“** → übergibt Kunde A + Referenz + Konzept-Richtung an den
Prompt Generator.

**Logo/Farben fehlen?** Logo hochladbar, sonst Text-Logo; Farben sonst aus neutraler Premium-Palette.
**Schwache Referenz:** Referenzen mit optischem Score < 75 werden mit Warnung markiert
(„nicht als Design-Vorlage empfohlen“, für Inhalte/Struktur weiterhin nutzbar).

**Abgrenzung zum Kopieren:** Es wird **kein** Text/Bild/Logo/Code/Layout von B übernommen – nur die allgemeine
Stilrichtung. Bilder sind neutrale Platzhalter; Texte sind originelle deutsche Platzhalter. Jede Vorschau trägt den
Hinweis, dass sie ein eigenes Konzept ist.

## Pflicht-Tests (echte End-to-End-Prüfung)
`npm run dev` starten, dann in zweitem Terminal **`npm run test:pflicht`**. Das Skript prüft gegen die echten Websites:
1. Farbaudit Weinhaus Fledermaus (Blau, kein Rot) · 2. Farbaudit Leon (Grün/Creme) ·
A. Weinhaus + Café Feynsinn (blauer CTA final, Blueprint-Treue ≥ 80) ·
B. Leon + Café Feynsinn (Feynsinn-Struktur, Leon-Grün, echtes Hero-Bild, ehrliche Scores) ·
C. Leon + Mi-Da (andere Struktur, gleiche Kundenfarben) · D. Referenzwechsel ⇒ unterschiedliche Layout-Signaturen.
Exit-Code 0 nur bei 100 % PASS. **Grundprinzip: Kunde A bestimmt Branding/Farben/Logo/Bilder/Inhalte – Referenz B bestimmt
Struktur/Layout/Rhythmus – und jede andere Referenz muss ein sichtbar anderes Ergebnis liefern.**

## Spätere Verbesserungen
- Echtes Lighthouse für präzise Performance-Werte
- Tiefen-Crawl der Unterseiten statt nur Startseite
- Dominante Farben aus Screenshot-Pixeln statt CSS
- Awwwards/Webflow/Framer als eigene Struktur-Provider (nicht nur als Query-Begriff)
- SQLite/Postgres statt JSON, Multi-User & geteilte Reports
- Proxy-Rotation gegen Suchmaschinen-Blocking
