/**
 * Pflicht-Tests für die LL-Studio-Inspector-Kernlogik (gegen laufenden Dev-Server :3000).
 * Ausführen:  npm run test:pflicht
 * Exit-Code 0 nur, wenn ALLE Tests bestehen.
 */
const BASE = process.env.TEST_BASE || 'http://localhost:3000'

const hex2rgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
const hue = ({ r, g, b }) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (!d) return 0
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}
const sat = ({ r, g, b }) => { const mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0 }
const isBlueish = (h) => { const c = hex2rgb(h); return c && sat(c) > 0.15 && hue(c) >= 185 && hue(c) <= 250 }
const isGreenish = (h) => { const c = hex2rgb(h); return c && sat(c) > 0.1 && hue(c) >= 65 && hue(c) <= 175 }
const isReddish = (h) => { const c = hex2rgb(h); return c && sat(c) > 0.3 && (hue(c) <= 18 || hue(c) >= 345) }
const isGoldish = (h) => { const c = hex2rgb(h); return c && sat(c) > 0.25 && hue(c) >= 28 && hue(c) <= 55 }

const results = []
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

async function audit(url) {
  const r = await fetch(`${BASE}/api/color-audit?url=${encodeURIComponent(url)}`)
  const j = await r.json()
  if (!j.ok) throw new Error('Audit fehlgeschlagen: ' + j.error)
  return j.audit
}
async function generate(sourceUrl, name, loc, refUrl, refName, refColors) {
  const r = await fetch(`${BASE}/api/design-preview/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source: { name, industry: 'Restaurant', location: loc, url: sourceUrl, services: ['Mittagstisch'], colors: [] },
      inspiration: { companyName: refName, industry: 'Restaurant', url: refUrl, designStyle: 'elegant', colors: refColors, visualScore: 84, usefulSections: [], features: ['Reservierung'], fromAnalysis: true },
      analyzeSourceUrl: true,
      controls: { referenceStrength: 1 },
      seed: 0
    })
  })
  const j = await r.json()
  if (!j.ok) throw new Error('Generate fehlgeschlagen: ' + j.error)
  return j.result
}

const t0 = Date.now()
try {
  // ── Test 1: Farbaudit Weinhaus Fledermaus (blau/dunkel, KEIN rot) ──
  console.log('\n── Test 1: Farbaudit weinhausfledermaus.de ──')
  const wf = await audit('https://www.weinhausfledermaus.de/')
  check('WF: Primary ist blau', isBlueish(wf.roles.primary), `primary=${wf.roles.primary}`)
  check('WF: CTA ist blau', isBlueish(wf.roles.cta), `cta=${wf.roles.cta}`)
  check('WF: Primary/CTA/Accent NICHT rot', ![wf.roles.primary, wf.roles.cta, wf.roles.accent].some(isReddish), JSON.stringify([wf.roles.primary, wf.roles.cta, wf.roles.accent]))
  check('WF: dunkler Text erkannt', !!wf.roles.text && hex2rgb(wf.roles.text) && (hex2rgb(wf.roles.text).r + hex2rgb(wf.roles.text).g + hex2rgb(wf.roles.text).b) / 3 < 90, `text=${wf.roles.text}`)

  // ── Test 2: Farbaudit Leon (grün/beige/creme) ──
  console.log('\n── Test 2: Farbaudit leon-pulheim.de ──')
  const lp = await audit('https://www.leon-pulheim.de/')
  check('Leon: Primary ist grün', isGreenish(lp.roles.primary), `primary=${lp.roles.primary}`)
  check('Leon: CTA ist grün', isGreenish(lp.roles.cta), `cta=${lp.roles.cta}`)
  check('Leon: Primary/CTA NICHT braun/lila/rot', ![lp.roles.primary, lp.roles.cta].some((h) => isReddish(h)), '')

  // ── Test A/B: Leon + Café Feynsinn (Struktur wie Referenz + Leon-Farben final) ──
  console.log('\n── Test B: Leon + cafe-feynsinn.de (Vorschau) ──')
  const rb = await generate('https://www.leon-pulheim.de/', 'Leon Restaurant', 'Pulheim', 'https://www.cafe-feynsinn.de/', 'Café Feynsinn', ['#1a2436', '#c9a45c'])
  const pal = rb.concept.palette
  check('B: Blueprint OK (kein Fallback)', rb.referenceBlueprint?.ok === true && !rb.fallbackUsed, '')
  check('B: Hero folgt Referenz (cinematic-full)', rb.concept.heroType === rb.referenceBlueprint.heroType && rb.concept.heroType === 'cinematic-full', `hero=${rb.concept.heroType}`)
  check('B: Text-Overlay wie Referenz', rb.concept.overlay === true, '')
  check('B: Blueprint-Treue >= 80', (rb.blueprintMatch?.score ?? 0) >= 80, `score=${rb.blueprintMatch?.score}`)
  check('B: finaler CTA ist Leon-grün', isGreenish(pal.cta), `cta=${pal.cta}`)
  check('B: KEINE Referenzfarbe (Gold/Navy) final als CTA', !isGoldish(pal.cta), `cta=${pal.cta}`)
  check('B: echtes Leon-Hero-Bild genutzt', !!rb.concept.sections.find((s) => s.type === 'hero')?.imageUrl, '')
  check('B: Paletten-Genauigkeit >= 85', (rb.scores.paletteAccuracy ?? 0) >= 85, `pa=${rb.scores.paletteAccuracy}`)
  check('B: Style-Score = Blueprint-Treue (kein Fake-100 ohne Prüfung)', rb.scores.style === rb.blueprintMatch?.score, `style=${rb.scores.style}`)

  // ── Test C: Leon + Mi-Da (andere Struktur, gleiche Kundenfarben) ──
  console.log('\n── Test C: Leon + mida-restaurant.de (Vorschau) ──')
  const rc = await generate('https://www.leon-pulheim.de/', 'Leon Restaurant', 'Pulheim', 'https://mida-restaurant.de/', 'Mi-Da', ['#1a1413', '#c9a45c'])
  check('C: Blueprint OK', rc.referenceBlueprint?.ok === true, '')
  check('C: CTA weiterhin Leon-grün', isGreenish(rc.concept.palette.cta), `cta=${rc.concept.palette.cta}`)

  // ── Test D: Referenzwechsel ⇒ sichtbar anderes Layout ──
  console.log('\n── Test D: Feynsinn vs. Mi-Da (Layout-Differenz) ──')
  const sigB = rb.layoutSignature || ''
  const sigC = rc.layoutSignature || ''
  check('D: Layout-Signaturen unterscheiden sich', sigB !== sigC, `B=${sigB.slice(0, 50)} | C=${sigC.slice(0, 50)}`)
  const diffFields = ['heroType', 'backgroundStyle', 'overlay'].filter((k) => rb.concept[k] !== rc.concept[k])
  check('D: Hero/Hintergrund/Overlay unterscheiden sich in >=1 Punkt', diffFields.length >= 1, `unterschiedlich: ${diffFields.join(',') || 'keine'}`)

  // ── Test D2: ECHTE Struktur-Differenz (Sektionsreihenfolge kommt aus B, nicht Template) ──
  const ordB = (rb.generatedSectionOrder || []).join(' → ')
  const ordC = (rc.generatedSectionOrder || []).join(' → ')
  check('D2: generierte Sektionsreihenfolge unterscheidet sich', ordB !== ordC, `B=[${ordB}] C=[${ordC}]`)
  const seqB = (rb.referenceBlueprint?.sectionSequence || []).join(',')
  const seqC = (rc.referenceBlueprint?.sectionSequence || []).join(',')
  check('D2: erkannte B-Struktur unterscheidet sich', seqB !== seqC && seqB.length > 0, `B=[${seqB}] C=[${seqC}]`)
  check('D2: Hero ist erste Sektion nach Header (B)', (rb.generatedSectionOrder || [])[0] === 'header' && (rb.generatedSectionOrder || [])[1] === 'hero', ordB)
  check('D2: Hero ist erste Sektion nach Header (C)', (rc.generatedSectionOrder || [])[0] === 'header' && (rc.generatedSectionOrder || [])[1] === 'hero', ordC)
  check('D2: beide Blueprint-getrieben (kein Fallback)', rb.fallbackUsed === false && rc.fallbackUsed === false, `B=${rb.fallbackUsed} C=${rc.fallbackUsed}`)

  // ── Test A: Weinhaus + Feynsinn (blaue Kundenfarben final) ──
  console.log('\n── Test A: Weinhaus + cafe-feynsinn.de (Vorschau) ──')
  const ra = await generate('https://www.weinhausfledermaus.de/', 'Weinhaus Fledermaus', 'Köln', 'https://www.cafe-feynsinn.de/', 'Café Feynsinn', ['#1a2436', '#c9a45c'])
  check('A: finaler CTA ist Weinhaus-blau', isBlueish(ra.concept.palette.cta), `cta=${ra.concept.palette.cta}`)
  check('A: CTA NICHT rot & NICHT Referenz-gold', !isReddish(ra.concept.palette.cta) && !isGoldish(ra.concept.palette.cta), '')
  check('A: Blueprint-Treue >= 80', (ra.blueprintMatch?.score ?? 0) >= 80, `score=${ra.blueprintMatch?.score}`)
} catch (e) {
  check('Testlauf ohne Abbruch', false, String(e))
}

const pass = results.filter((r) => r.pass).length
console.log(`\n════ Ergebnis: ${pass}/${results.length} bestanden · ${Math.round((Date.now() - t0) / 1000)}s ════`)
process.exit(pass === results.length ? 0 : 1)
