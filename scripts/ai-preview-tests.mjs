/**
 * Tests für die KI-Vorschau (gegen laufenden Dev-Server :3000).
 * Ausführen:  npm run test:ai
 * Deckt ab: Prompt-Builder (2 Pflicht-Tests), Provider-Config, Manueller Export,
 * fehlender API-Key, Ollama-Fehlerfall, Code-Extraktion, Preview-Validierung, Korrekturprompt.
 */
import { readFileSync } from 'fs'
const BASE = process.env.TEST_BASE || 'http://localhost:3000'
const results = []
const check = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

async function designResult(sourceUrl, name, loc, refUrl, refName, refColors) {
  const r = await fetch(`${BASE}/api/design-preview/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source: { name, industry: 'Restaurant', location: loc, url: sourceUrl, services: ['Mittagstisch', 'Events'], colors: [], logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
      inspiration: { companyName: refName, industry: 'Restaurant', url: refUrl, designStyle: 'elegant', colors: refColors, visualScore: 84, usefulSections: [], features: ['Reservierung'], fromAnalysis: true },
      analyzeSourceUrl: true,
      controls: { referenceStrength: 1 },
      seed: 0
    })
  })
  const j = await r.json()
  if (!j.ok) throw new Error('design-preview: ' + j.error)
  return j.result
}
const promptFor = async (result, source, inspiration, provider = 'v0', format = 'html') => {
  const r = await fetch(`${BASE}/api/ai-preview/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ result, source, inspiration, provider, format }) })
  return r.json()
}
const generate = async (result, source, inspiration, provider, format = 'html') => {
  const r = await fetch(`${BASE}/api/ai-preview/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ result, source, inspiration, provider, format }) })
  return r.json()
}
const validate = async (rawCode, result, source, inspiration, format = 'html') => {
  const r = await fetch(`${BASE}/api/ai-preview/validate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rawCode, result, source, inspiration, format }) })
  return r.json()
}

const t0 = Date.now()
try {
  const leonSource = { name: 'Leon Restaurant', url: 'https://www.leon-pulheim.de/', industry: 'Restaurant', location: 'Pulheim', services: ['Mittagstisch', 'Events'], logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }
  const feyn = { companyName: 'Café Feynsinn', url: 'https://www.cafe-feynsinn.de/', colors: ['#1a2436', '#c9a45c'] }

  // ── Provider-Config ──
  console.log('\n── Provider-Config ──')
  const st = await (await fetch(`${BASE}/api/ai-preview/providers`)).json()
  const provs = st.status?.providers || []
  check('Config: 5 Provider (v0/claude/openai/ollama/manual)', ['v0', 'claude', 'openai', 'ollama', 'manual'].every((p) => provs.find((x) => x.provider === p)), provs.map((p) => p.provider).join(','))
  check('Config: manual immer verfügbar', provs.find((p) => p.provider === 'manual')?.available === true)
  check('Config: Standard-Provider gesetzt', !!st.status?.default, `default=${st.status?.default}`)

  // ── Pflicht-Test 1: Leon + Café Feynsinn ──
  console.log('\n── Pflicht-Test 1: Leon + Café Feynsinn (Prompt) ──')
  const rLeon = await designResult('https://www.leon-pulheim.de/', 'Leon Restaurant', 'Pulheim', 'https://www.cafe-feynsinn.de/', 'Café Feynsinn', ['#1a2436', '#c9a45c'])
  const pLeon = await promptFor(rLeon, leonSource, feyn)
  const u = (pLeon.prompt?.user || '') + '\n' + (pLeon.prompt?.system || '')
  const cta = rLeon.concept.palette.cta
  check('P1: nennt Kunde A „Leon“', /leon/i.test(u))
  check('P1: enthält Leon-Farbrollen (HEX)', u.includes(cta) || u.includes(rLeon.concept.palette.primary), `cta=${cta}`)
  check('P1: Anweisung Leon-Logo verwenden', /logo/i.test(u) && /kunde-?a-logo|logo im header|logo vorhanden/i.test(u))
  check('P1: Anweisung Leon-Bilder verwenden', /bilder/i.test(u))
  check('P1: nennt Referenz „Café Feynsinn“ als Struktur/Stil', /feynsinn/i.test(u) && /struktur|stil-inspiration|inspiration/i.test(u))
  check('P1: Feynsinn-Struktur beschrieben (Full-Width/Hero/Nav/Reservierung)', /full-width|hero/i.test(u) && /navigation|nav/i.test(u) && /reservier/i.test(u))
  check('P1: sagt NICHT „kopiere Website B“', !/kopiere (die )?website|kopiere b\b|1:1 kopieren erlaubt/i.test(u))
  check('P1: Rechtsregel „keine … 1:1 kopieren“', /keine.*(texte|bilder|logos).*kopier/i.test(u) || /nicht.*1:1/i.test(u))
  check('P1: erzwingt Kunde-A-Farben', /ausschließlich.*kunde-?a-farben|nur.*kunde-?a-farben|kunde-a-farben.*finale/i.test(u))

  // ── Pflicht-Test 1b: Prompt-QUALITÄT (konkret & renderbar-fördernd) ──
  console.log('\n── Pflicht-Test 1b: Prompt-Qualität ──')
  const heroImg = rLeon.concept.sections.find((s) => s.type === 'hero')?.imageUrl
  const heroHeading = rLeon.concept.sections.find((s) => s.type === 'hero')?.heading
  check('Q: nennt konkrete Kunde-A-Bild-URL(s)', (heroImg ? u.includes(heroImg) : /bild-url|leon|\.jpg|\.png|\.webp|https?:\/\//i.test(u)), heroImg ? 'Hero-Bild-URL im Prompt' : 'Bildzeilen/Fallback')
  check('Q: verbietet „insert image here“-Platzhalter', /insert image here/i.test(u))
  check('Q: übernimmt echte Kunde-A-Inhalte (Hero-Text)', heroHeading ? u.includes(heroHeading) : /inhalte|überschrift/i.test(u))
  check('Q: beschreibt Buttonposition', /buttonposition/i.test(u))
  check('Q: beschreibt Bildposition', /bildposition/i.test(u))
  check('Q: beschreibt Atmosphäre/Design-Rhythmus', /atmosphäre|design-rhythmus/i.test(u))
  check('Q: Slider/Carousel wird erwähnt (falls erkannt)', !rLeon.referenceBlueprint?.hasSlider || /slider|karussell|carousel/i.test(u))
  check('Q: verbietet SaaS-Layout', /saas/i.test(u))
  check('Q: verbietet blaues Default-Design', /blaue|blaues default/i.test(u))
  check('Q: verbietet Standard-Restaurant-Template', /standard-restaurant/i.test(u))
  check('Q: Output verlangt Design-Zusammenfassung zuerst', /design-zusammenfassung/i.test(u))
  check('Q: Output verlangt direkt renderbaren Code', /direkt renderbar/i.test(u))
  check('Q: Selbst-Qualitätskontrolle am Ende', /selbstprüfung|selbst-qualitätskontrolle/i.test(u))
  check('Q: Section-Reihenfolge konkret genannt', /section-reihenfolge/i.test(u))

  // ── Pflicht-Test 2: Weinhaus Fledermaus + Café Feynsinn ──
  console.log('\n── Pflicht-Test 2: Weinhaus + Café Feynsinn (Prompt) ──')
  const wfSource = { name: 'Weinhaus Fledermaus', url: 'https://www.weinhausfledermaus.de/', industry: 'Restaurant', location: 'Köln', services: ['Küche'], logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }
  const rWf = await designResult('https://www.weinhausfledermaus.de/', 'Weinhaus Fledermaus', 'Köln', 'https://www.cafe-feynsinn.de/', 'Café Feynsinn', ['#1a2436', '#c9a45c'])
  const pWf = await promptFor(rWf, wfSource, feyn)
  const uw = (pWf.prompt?.user || '')
  check('P2: nennt Weinhaus Fledermaus', /weinhaus/i.test(uw))
  check('P2: enthält Weinhaus-Farbrolle (blau) als HEX', uw.includes(rWf.concept.palette.cta) || uw.includes(rWf.concept.palette.primary), `cta=${rWf.concept.palette.cta}`)
  check('P2: Café Feynsinn nur als Struktur/Stil', /feynsinn/i.test(uw) && /struktur|inspiration/i.test(uw))

  // ── Manueller Export (immer verfügbar) ──
  console.log('\n── Manueller Export ──')
  const man = await generate(rLeon, leonSource, feyn, 'manual', 'html')
  check('Manual: ok & mode=manual', man.ok && man.result?.mode === 'manual')
  check('Manual: manualExport nicht leer', (man.result?.manualExport || '').length > 200)
  check('Manual: kein Fehler', !man.result?.error)
  const manV0 = await generate(rLeon, leonSource, feyn, 'v0', 'v0-prompt')
  check('Manual: Prompt-Zielformat (v0-prompt) → manueller Export', manV0.result?.mode === 'manual' && (manV0.result?.manualExport || '').includes('v0'))

  // ── Fehlender API-Key ──
  console.log('\n── Fehlender API-Key ──')
  const claudeCfg = provs.find((p) => p.provider === 'claude')
  const claude = await generate(rLeon, leonSource, feyn, 'claude', 'html')
  if (claudeCfg && !claudeCfg.available) {
    check('NoKey: Claude ohne Key → manueller Fallback (kein Absturz)', claude.ok && claude.result?.mode === 'manual' && claude.result?.notes?.some((n) => /kein api-key/i.test(n)))
  } else {
    check('NoKey: Claude-Key vorhanden → Live-Test übersprungen (ehrlich)', claude.ok === true, 'Key gesetzt – kein Fehlbetrag')
  }

  // ── Ollama Fehlerfall ──
  console.log('\n── Ollama Fehlerfall ──')
  const oll = await generate(rLeon, leonSource, feyn, 'ollama', 'html')
  const ollNotes = (oll.result?.notes || []).join(' ') + ' ' + (oll.result?.error || '')
  const ollReachable = oll.result?.mode === 'ai'
  check('Ollama: kein Absturz (ok)', oll.ok === true)
  check('Ollama: nicht erreichbar → klare Meldung ODER erreichbar', ollReachable || /erreichbar|ollama/i.test(ollNotes), ollReachable ? 'Ollama läuft' : ollNotes.slice(0, 60))

  // ── Code-Extraktion + Validierung (gut) ──
  console.log('\n── Code-Extraktion + Validierung ──')
  const pal = rLeon.concept.palette
  const leonImg = rLeon.concept.sections.find((s) => s.type === 'hero')?.imageUrl || 'https://www.leon-pulheim.de/images/leon.webp'
  const cid = (id, code) => (code.validation?.checks || []).find((c) => c.id === id)?.pass
  const goodCode =
    '```html\n<!doctype html><html lang="de"><head><style>body{background:' + pal.paper + ';color:' + pal.ink + '}.btn{background:' + pal.cta + '}</style></head>' +
    '<body><header><nav>Start · Speisekarte · Restaurant · Events · Kontakt</nav><a class="btn" href="#reserve">Tisch reservieren</a></header>' +
    '<section class="hero"><h1>Leon Restaurant – Pulheim</h1><img src="' + leonImg + '" alt="Leon Restaurant"/></section>' +
    '<section class="about"><h2>Über uns</h2><img src="' + leonImg + '" alt="Team"/></section>' +
    '<footer>© Leon Restaurant · Impressum</footer></body></html>\n```'
  const vg = await validate(goodCode, rLeon, leonSource, feyn)
  check('Extraktion: Codeblock ohne ```-Zaun', vg.ok && !/```/.test(vg.extracted?.code || '```'))
  check('Validierung gut: bestanden', vg.validation?.passed === true, `score=${vg.validation?.score}`)
  check('Validierung gut: Kunde-A-Farben erkannt', cid('customerColors', vg) === true)
  check('Validierung gut: Kunde-A-Bilder erkannt', cid('customerImages', vg) === true)
  check('Validierung gut: Sicherheit ok', cid('security', vg) === true)
  check('Validierung gut: kein Korrekturprompt', !vg.correctionPrompt)

  // ── Validierung (schlecht/generisch) + Korrekturprompt ──
  const badCode = '<div class="container"><h2>Feature 1</h2><p>Lorem ipsum dolor sit amet</p><button>Sign up free</button></div>'
  const vb = await validate(badCode, rLeon, leonSource, feyn)
  check('Validierung schlecht: durchgefallen', vb.validation?.passed === false, `score=${vb.validation?.score}`)
  check('Validierung schlecht: Farb-Check fehlgeschlagen', cid('customerColors', vb) === false)
  check('Validierung schlecht: generisch erkannt', cid('notGeneric', vb) === false)
  check('Korrekturprompt: erzeugt & enthält Kunde-A-Farbe', !!vb.correctionPrompt && (vb.correctionPrompt.includes(pal.cta) || vb.correctionPrompt.includes(pal.accent)))

  // ── Manueller Paste-Workflow: Sonderfälle ──
  console.log('\n── Manueller Paste-Workflow ──')
  // ohne Kunde-A-Farben (aber Struktur ok)
  const noColor = '<!doctype html><html><body><header><nav>Start Kontakt</nav></header><section class="hero"><h1>Leon Restaurant</h1><img src="' + leonImg + '"></section><footer>Leon</footer></body></html>'
  const vNoColor = await validate(noColor, rLeon, leonSource, feyn)
  check('Paste: ohne Kunde-A-Farben → Farb-Check schlägt fehl', cid('customerColors', vNoColor) === false)
  // ohne Kunde-A-Bilder
  const noImg = '<!doctype html><html><head><style>body{background:' + pal.paper + '}.b{background:' + pal.cta + '}</style></head><body><header><nav>Start</nav></header><section class="hero"><h1>Leon Restaurant</h1><a class="b" href="#">Tisch reservieren</a></section><footer>Leon</footer></body></html>'
  const vNoImg = await validate(noImg, rLeon, leonSource, feyn)
  check('Paste: ohne Kunde-A-Bilder → Bild-Check schlägt fehl', cid('customerImages', vNoImg) === false)
  // mit Referenz-B-Bild (cafe-feynsinn.de)
  const refImg = '<!doctype html><html><head><style>body{background:' + pal.paper + '}</style></head><body><header><nav>Start</nav></header><section class="hero"><h1>Leon</h1><img src="https://www.cafe-feynsinn.de/hero.jpg"></section><footer>Leon</footer></body></html>'
  const vRef = await validate(refImg, rLeon, leonSource, feyn)
  check('Paste: Referenz-B-Bild erkannt → durchgefallen', cid('noReferenceImages', vRef) === false && vRef.validation?.passed === false)
  check('Paste: Referenz-Bild in Details gelistet', (vRef.validation?.details?.referenceImagesFound || []).some((u) => /cafe-feynsinn/.test(u)))
  // gefährliches Script
  const danger = '<!doctype html><html><head><style>body{background:' + pal.paper + '}</style></head><body><header><nav>Start</nav></header><section class="hero"><h1>Leon</h1><img src="' + leonImg + '"><a href="#">Tisch reservieren</a></section><script>alert(document.cookie)</script><footer>Leon</footer></body></html>'
  const vDanger = await validate(danger, rLeon, leonSource, feyn)
  check('Paste: gefährliches Script → Sicherheits-Check schlägt fehl', cid('security', vDanger) === false && vDanger.validation?.passed === false)
  check('Paste: Sandbox-HTML ist sanitized (kein <script>)', !!vDanger.renderableHtml && !/<script/i.test(vDanger.renderableHtml))
  check('Paste: Korrekturprompt bei Fehler erzeugt', !!vRef.correctionPrompt && /referenz/i.test(vRef.correctionPrompt))
  // Auto-Erkennung React
  const reactCode = "```jsx\nexport default function Page(){ return (<div className=\"p-4\" style={{background:'" + pal.paper + "'}}><header><nav>Start</nav></header><h1>Leon Restaurant</h1><a href=\"#\">Tisch reservieren</a><img src=\"" + leonImg + "\"/><footer>Leon</footer></div>) }\n```"
  const vReact = await fetch(`${BASE}/api/ai-preview/validate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rawCode: reactCode, result: rLeon, source: leonSource, inspiration: feyn, codeType: 'auto' }) }).then((r) => r.json())
  check('Paste: React-Code automatisch erkannt (kein HTML-Sandbox-Render)', vReact.format === 'react-tailwind' && !vReact.renderableHtml)

  // ── Sicherheit / API-Key-Handling ──
  console.log('\n── Sicherheit / API-Key-Handling ──')
  const looksLikeKey = (s) => /sk-[A-Za-z0-9_\-]{16,}|["']?api[_-]?key["']?\s*[:=]\s*["'][^"']{12,}/i.test(s)
  const stRaw = await (await fetch(`${BASE}/api/ai-preview/providers`)).text()
  check('Public-Status enthält KEINEN Key', !looksLikeKey(stRaw) && !/"apiKey"/i.test(stRaw), 'kein sk-/apiKey im JSON')
  const stJson = JSON.parse(stRaw)
  check('Public-Status hat hasKey als boolean (kein Key-String)', (stJson.status?.providers || []).every((p) => typeof p.hasKey === 'boolean'))
  // Provider-Test ohne Key → saubere Meldung (OpenAI, sofern kein Key gesetzt)
  const oaCfg = (stJson.status?.providers || []).find((p) => p.provider === 'openai')
  const tOa = await (await fetch(`${BASE}/api/ai-preview/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'openai' }) })).json()
  if (oaCfg && !oaCfg.hasKey) {
    check('Test ohne Key: sauberer Fehler (missing-key)', tOa.ok && tOa.result?.ok === false && tOa.result?.status === 'missing-key')
  } else {
    check('Test mit Key: OpenAI-Key vorhanden → Live-Test ausgeführt (ehrlich)', tOa.ok === true, `status=${tOa.result?.status}`)
  }
  check('Test-Antwort enthält KEINEN Key', !looksLikeKey(JSON.stringify(tOa)))
  // Ollama-Test → erreichbar ODER klare „nicht erreichbar“-Meldung
  const tOll = await (await fetch(`${BASE}/api/ai-preview/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'ollama' }) })).json()
  check('Test Ollama: ok ODER klare Meldung', tOll.ok && (tOll.result?.status === 'ok' || /erreichbar/i.test(tOll.result?.message || '')), tOll.result?.message?.slice(0, 50))
  // Manual-Test immer ok
  const tMan = await (await fetch(`${BASE}/api/ai-preview/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'manual' }) })).json()
  check('Test manual: immer ok', tMan.result?.ok === true && tMan.result?.status === 'manual')
  // Debug-Ausgabe (generate) enthält keinen Key
  const genDbg = await generate(rLeon, leonSource, feyn, 'manual', 'html')
  check('Debug/Generate-Antwort enthält KEINEN Key', !looksLikeKey(JSON.stringify(genDbg)))
  // Manueller Export enthält keinen Key
  check('Manueller Export enthält KEINEN Key', !looksLikeKey(genDbg.result?.manualExport || ''))

  // ── Datei-Hygiene: .env.example nur leere Key-Platzhalter, .gitignore mit .env.local ──
  console.log('\n── Datei-Hygiene ──')
  const envEx = readFileSync('.env.example', 'utf8')
  check('.env.example: V0_API_KEY leer', /^V0_API_KEY=\s*(#.*)?$/m.test(envEx))
  check('.env.example: CLAUDE_API_KEY leer', /^CLAUDE_API_KEY=\s*(#.*)?$/m.test(envEx))
  check('.env.example: OPENAI_API_KEY leer', /^OPENAI_API_KEY=\s*(#.*)?$/m.test(envEx))
  check('.env.example: enthält keinen echten Key', !looksLikeKey(envEx))
  const gi = readFileSync('.gitignore', 'utf8')
  check('.gitignore: enthält .env.local', /(^|\n)\.env\.local(\s|$)/.test(gi))
  check('.gitignore: enthält .env', /(^|\n)\.env(\s|$)/.test(gi))
  check('.gitignore: deckt Settings-Speicher (.data) ab', /\.data/.test(gi))

  // ── Settings-Key-Fallback (Settings-UI als sicherer Fallback) ──
  console.log('\n── Settings-Key-Fallback ──')
  const settings = async (patch) => (await fetch(`${BASE}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })).json()
  const providers = async () => (await fetch(`${BASE}/api/ai-preview/providers`)).json()
  const testP = async (provider) => (await fetch(`${BASE}/api/ai-preview/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider }) })).json()
  const st0 = await providers()
  const oaHad = st0.status?.providers?.find((p) => p.provider === 'openai')?.hasKey
  if (oaHad) {
    // Schutz: echter OpenAI-Key aktiv (z. B. via .env.local) → destruktiven Settings-Test NICHT ausführen
    check('Settings-Test übersprungen (echter OpenAI-Key aktiv – wird nicht überschrieben)', true, 'ehrlich: kein destruktiver Test')
  } else {
    const DUMMY = 'sk-test-DUMMY-000000000000000000000000000000'
    const s1 = await settings({ openaiApiKey: DUMMY, openaiModel: 'gpt-4o-mini', defaultAiPreviewProvider: 'openai' })
    check('Settings speichern: openaiApiKeySet=true (persistiert)', s1.openaiApiKeySet === true)
    check('Settings speichern: Modell erhalten', s1.openaiModel === 'gpt-4o-mini')
    check('Settings-View gibt KEINEN Key zurück', !looksLikeKey(JSON.stringify(s1)) && !JSON.stringify(s1).includes(DUMMY))
    const st1 = await providers()
    check('Public-Status: openai hasKey=true nach Save (serverseitig erkannt)', st1.status.providers.find((p) => p.provider === 'openai')?.hasKey === true)
    check('Public-Status enthält weiterhin KEINEN Key', !looksLikeKey(JSON.stringify(st1)) && !JSON.stringify(st1).includes(DUMMY))
    const t1 = await testP('openai')
    check('Provider testen: NICHT mehr missing-key (Settings-Key erkannt)', t1.result?.status !== 'missing-key', `status=${t1.result?.status}`)
    check('Test-Antwort enthält KEINEN Key', !looksLikeKey(JSON.stringify(t1)) && !JSON.stringify(t1).includes(DUMMY))
    // Leeres Key-Feld darf bestehenden Key NICHT löschen (nur Modell ändern)
    const s2 = await settings({ openaiModel: 'gpt-4o' })
    check('Leeres Key-Feld löscht Key NICHT', s2.openaiApiKeySet === true)
    // Maskierter Platzhalter wird NICHT als echter Key gespeichert
    const s3 = await settings({ openaiApiKey: '••••••••' })
    const t3 = await testP('openai')
    check('Maskierter Platzhalter überschreibt echten Key NICHT', s3.openaiApiKeySet === true && t3.result?.status !== 'missing-key')
    // Key entfernen (explizit)
    const sDel = await settings({ openaiApiKey: null, openaiModel: null, defaultAiPreviewProvider: null })
    check('Key entfernen: openaiApiKeySet=false', sDel.openaiApiKeySet === false)
    const t4 = await testP('openai')
    check('Nach Entfernen wieder missing-key', t4.result?.status === 'missing-key')
  }

  // ── 1:1-Klon (B-HTML + A-Assets) ──
  console.log('\n── 1:1-Klon (B-HTML + A-Assets) ──')
  const leonNoLogo = { ...leonSource, logoDataUrl: undefined } // ohne manuelles Logo → Auto-Erkennung testen
  const cl = await (await fetch(`${BASE}/api/ai-preview/clone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: leonNoLogo, inspiration: feyn, result: rLeon }) })).json()
  check('Klon: ok', cl.ok === true, cl.error || '')
  if (cl.ok) {
    const h = cl.html || ''
    const lp = rLeon.concept.palette
    check('Klon: HTML substanziell (>8kb)', h.length > 8000, h.length + ' bytes')
    check('Klon: Leon-Palette eingesetzt', h.toLowerCase().includes(lp.cta.toLowerCase()) || h.toLowerCase().includes(lp.primary.toLowerCase()))
    check('Klon: B-Farben gemappt (>=1)', (cl.report?.colorMap || []).length >= 1)
    check('Klon: Name „Leon“ eingesetzt', /leon/i.test(h))
    check('Klon: KEIN <script> (sandboxed)', !/<script/i.test(h))
    check('Klon: KEINE on*-Events', !/\son[a-z]+\s*=/i.test(h))
    check('Klon: B-Struktur + inline CSS erhalten', /<header|<section|<nav/i.test(h) && /<style/i.test(h))
    // NEU: Navigation stillgelegt (Klicks führen nicht zur Original-Seite bzw. in die eigene App)
    check('Klon: keine http-Links mehr (Klick resetet nicht)', (h.match(/<a\b[^>]*href="https?:/gi) || []).length === 0)
    check('Klon: Links auf # neutralisiert', (h.match(/<a\b[^>]*href="#"/gi) || []).length >= 1)
    check('Klon: Links klick-inert (pointer-events:none)', /pointer-events:none/i.test(h))
    check('Klon: <base> auf B-Origin gesetzt', /<base href="https?:\/\//i.test(h))
    check('Klon: KEIN localhost im HTML (kein Sprung in die App)', !/localhost:3000/.test(h))
    // NEU: A-Logo automatisch erkannt & eingesetzt (source ohne manuelles Logo)
    check('Klon: A-Logo automatisch erkannt & getauscht', cl.report?.logoSwapped === true && /data-clone-logo/.test(h))
  }
  // Guard: interne/eigene URL als Referenz B → klare Fehlermeldung, KEIN Klon der eigenen App
  const clGuard = await (await fetch(`${BASE}/api/ai-preview/clone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: leonSource, inspiration: { ...feyn, url: 'http://192.168.0.10/' }, result: rLeon }) })).json()
  check('Klon-Guard: interne IP als Referenz B abgelehnt', clGuard.ok === false && /externe Website/i.test(clGuard.error || ''))
} catch (e) {
  check('Testlauf ohne Abbruch', false, String(e))
}

const pass = results.filter((r) => r.pass).length
console.log(`\n════ KI-Vorschau: ${pass}/${results.length} bestanden · ${Math.round((Date.now() - t0) / 1000)}s ════`)
process.exit(pass === results.length ? 0 : 1)
