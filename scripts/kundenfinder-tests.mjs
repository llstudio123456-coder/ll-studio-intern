/**
 * Tests für den Kundenfinder – Fokus: DUBLETTEN-SCHUTZ (zentrale Erfolgsbedingung).
 * Läuft gegen den Dev-Server :3000, nutzt eindeutige Test-Domains und räumt am Ende auf.
 * Ausführen: npm run test:kundenfinder
 */
const BASE = process.env.TEST_BASE || 'http://localhost:3000'
const TOKEN = 'kftest' + Math.random().toString(36).slice(2, 8)
const created = new Set()
const results = []
const check = (n, ok, d = '') => { results.push({ n, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`) }

async function imp(candidates) {
  const r = await fetch(`${BASE}/api/kundenfinder/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ candidates }) })
  const j = await r.json()
  if (!j.ok) throw new Error('import: ' + j.error)
  ;(j.ids || []).forEach((id) => created.add(id))
  ;(j.details || []).forEach((d) => d.companyId && created.add(d.companyId))
  return j
}
const action = async (action, id, extra = {}) => (await fetch(`${BASE}/api/kundenfinder/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }) })).json()
const getCompany = async (id) => (await fetch(`${BASE}/api/kundenfinder/company/${id}`)).json()

try {
  // 1) Gleiches Unternehmen über zwei „Quellen“ (Homepage + Kontakt-Unterseite derselben Domain)
  console.log('\n── 1: gleiche Domain (Homepage vs. /kontakt) ──')
  const dom = `${TOKEN}-muster.de`
  const a = await imp([{ name: 'Muster GmbH', website: `https://www.${dom}`, plz: '50259', city: 'Pulheim', houseNumber: '5', source: 'osm' }])
  const b = await imp([{ name: 'Muster', website: `https://${dom}/kontakt`, plz: '50259', city: 'Pulheim', source: 'manuell' }])
  check('1: erste Erfassung ist neu', a.neu === 1)
  check('1: zweite (gleiche Domain, andere Unterseite) = Dublette', b.duplicates === 1 && b.neu === 0, JSON.stringify(b.details?.[0]))

  // 2) Unterschiedliche Telefon-Formatierung → dieselbe Nummer
  console.log('\n── 2: Telefon-Formatierung ──')
  const p1 = await imp([{ name: `Elektro ${TOKEN} A`, phone: '0221 5551234567', plz: '50667', city: 'Köln', source: 'osm' }])
  const p2 = await imp([{ name: `Elektro ${TOKEN} B`, phone: '+49 221 / 5551234567', plz: '50667', city: 'Köln', source: 'manuell' }])
  check('2: gleiche Telefonnummer trotz anderer Schreibweise = Dublette', p2.duplicates === 1, JSON.stringify(p2.details?.[0]))

  // 3) Name mit/ohne Rechtsform, gleiche PLZ, keine Domain → Fingerprint-Dublette
  console.log('\n── 3: Rechtsform-Varianten (Fingerprint) ──')
  const n1 = await imp([{ name: `Bäckerei ${TOKEN} Sonne GmbH`, plz: '50226', city: 'Frechen', houseNumber: '12', source: 'osm' }])
  const n2 = await imp([{ name: `Bäckerei ${TOKEN} Sonne`, plz: '50226', city: 'Frechen', houseNumber: '12', source: 'csv' }])
  check('3: „GmbH“ vs. ohne Rechtsform (gleicher Fingerprint) = Dublette', n2.duplicates === 1, JSON.stringify(n2.details?.[0]))

  // 9) Ähnlicher Name, ABER andere Adresse/PLZ/Domain → NICHT zusammenführen
  console.log('\n── 9: ähnlicher Name, andere Adresse → eigenständig ──')
  const s1 = await imp([{ name: `Autohaus ${TOKEN} Nord`, website: `https://${TOKEN}-nord.de`, plz: '50999', city: 'Köln', source: 'osm' }])
  const s2 = await imp([{ name: `Autohaus ${TOKEN} Nord`, website: `https://${TOKEN}-sued.de`, plz: '52222', city: 'Aachen', source: 'osm' }])
  check('9: gleicher Name aber andere Stadt+Domain = NEU (kein falsches Merge)', s2.neu === 1 && s2.duplicates === 0, JSON.stringify(s2.details?.[0]))

  // 5+7) Ausgeschlossenes/abgelehntes Unternehmen wird NIE erneut als neuer Lead vorgeschlagen
  console.log('\n── 5/7: abgelehnt/ausgeschlossen → nie erneut neu ──')
  const exId = a.details.find((d) => d.dupStatus === 'new')?.companyId
  const ex = await action('exclude', exId, { reason: 'kein interesse', status: 'abgelehnt' })
  check('5: Ausschluss gesetzt', ex.ok && ex.company?.excluded === true && ex.company?.status === 'abgelehnt')
  const reFound = await imp([{ name: 'Muster GmbH', website: `https://www.${dom}/impressum`, plz: '50259', city: 'Pulheim', source: 'osm' }])
  check('5: erneut gefunden → Dublette (nicht neu)', reFound.neu === 0 && reFound.duplicates === 1)
  check('7: Dublette verweist auf dasselbe (ausgeschlossene) Unternehmen', reFound.details?.[0]?.companyId === exId)

  // 8) CSV-Import mit bereits bekanntem Unternehmen → Dublette
  console.log('\n── 8: CSV-Import mit bekanntem Unternehmen ──')
  const csv = `name;plz;ort;website\nMuster GmbH;50259;Pulheim;${dom}\nNeuer ${TOKEN} Betrieb;50999;Köln;${TOKEN}-neu.de`
  const csvR = await (await fetch(`${BASE}/api/kundenfinder/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv }) })).json()
  ;(csvR.ids || []).forEach((id) => created.add(id))
  ;(csvR.details || []).forEach((d) => d.companyId && created.add(d.companyId))
  check('8: CSV erkennt bekanntes Unternehmen als Dublette, neues als neu', csvR.duplicates === 1 && csvR.neu === 1, JSON.stringify({ neu: csvR.neu, dup: csvR.duplicates }))

  // 16) Aus normaler Ansicht entfernen (Ausschluss) behält Dubletten-Schutz; erst „vollständig entfernen“ hebt ihn auf
  console.log('\n── 16: vollständige Entfernung hebt Dubletten-Schutz auf ──')
  const delTarget = s1.details.find((d) => d.dupStatus === 'new')?.companyId
  created.delete(delTarget)
  const del = await action('remove', delTarget)
  check('16: vollständige Entfernung erfolgreich', del.ok === true)
  const reAfterDel = await imp([{ name: `Autohaus ${TOKEN} Nord`, website: `https://${TOKEN}-nord.de`, plz: '50999', city: 'Köln', source: 'osm' }])
  check('16: nach vollständiger Entfernung wieder als NEU möglich', reAfterDel.neu === 1, JSON.stringify(reAfterDel.details?.[0]))

  // Export liefert CSV
  console.log('\n── Export ──')
  const exp = await fetch(`${BASE}/api/kundenfinder/export?q=${TOKEN}`)
  const expText = await exp.text()
  check('Export: CSV-Header + Testzeilen', exp.headers.get('content-type')?.includes('text/csv') && /Unternehmen;Branche/.test(expText) && expText.includes(TOKEN))

  // ── Phase 2: Qualifizierung (Kontaktvollständigkeit · Akquise-Priorität · Nachrecherche · KI-Notiz) ──
  console.log('\n── Phase 2: Qualifizierung ──')
  const getC = async (id) => (await fetch(`${BASE}/api/kundenfinder/company/${id}`)).json()
  const T2 = TOKEN + 'q'
  // Fall 1/5: kein Website + Telefon + E-Mail → Priorität A, Kontakt vollständig
  const q1 = await imp([{ name: `${T2} Voll GmbH`, plz: '50111', city: 'Köln', phone: '0221 5559990001', email: `a@${T2}-voll.de`, industry: 'Elektriker', source: 'osm' }])
  const id1 = q1.details[0].companyId
  const c1 = (await getC(id1)).company
  check('P2-1: volle Kontaktdaten → Kontakt „vollständig“', c1.contactCompleteness === 'vollstaendig')
  check('P2-1/5: schlechte/keine Website + volle Kontakte → Priorität A', c1.acquisitionPriority === 'A', `prio=${c1.acquisitionPriority} score=${c1.acquisitionScore}`)
  check('P2-1: KI-Website-Notiz erzeugt', typeof c1.aiWebsiteNote === 'string' && c1.aiWebsiteNote.length > 10)
  // Fall 2: nur Telefon (E-Mail fehlt) → teilweise → Nachrecherche, nicht A
  const q2 = await imp([{ name: `${T2} NurTel`, plz: '50222', city: 'Frechen', phone: '0221 5559990002', industry: 'Maler', source: 'osm' }])
  const c2 = (await getC(q2.details[0].companyId)).company
  check('P2-2: nur Telefon → Kontakt „teilweise“', c2.contactCompleteness === 'teilweise')
  check('P2-2: teilweise → nicht Priorität A', c2.acquisitionPriority !== 'A', `prio=${c2.acquisitionPriority}`)
  // Fall 3: nur E-Mail → teilweise
  const q3 = await imp([{ name: `${T2} NurMail`, plz: '50333', city: 'Hürth', email: `b@${T2}-mail.de`, industry: 'Friseur', source: 'osm' }])
  const c3 = (await getC(q3.details[0].companyId)).company
  check('P2-3: nur E-Mail → Kontakt „teilweise“', c3.contactCompleteness === 'teilweise')
  // Fall 4: weder noch → keine → Priorität D (nie A)
  const q4 = await imp([{ name: `${T2} KeinKontakt`, plz: '50444', city: 'Wesseling', industry: 'Sonstiges', source: 'osm' }])
  const c4 = (await getC(q4.details[0].companyId)).company
  check('P2-4: keine Kontaktdaten → Kontakt „keine“', c4.contactCompleteness === 'keine')
  check('P2-4: keine Kontaktdaten → NICHT Priorität A (Klasse D)', c4.acquisitionPriority === 'D')
  // Standardliste (qualifiziert) enthält nur vollständige; Nachrecherche enthält die unvollständigen
  const qualified = (await (await fetch(`${BASE}/api/kundenfinder/companies?contact=vollstaendig&q=${T2}&stats=1`)).json())
  const nach = (await (await fetch(`${BASE}/api/kundenfinder/companies?contact=unvollstaendig&q=${T2}`)).json())
  const qIds = qualified.companies.map((c) => c.id)
  const nIds = nach.companies.map((c) => c.id)
  check('P2: qualifizierte Liste enthält NUR vollständige Kontakte', qIds.includes(id1) && !qIds.includes(c2.id) && !qIds.includes(c4.id))
  check('P2: Nachrecherche enthält die unvollständigen (nicht die vollständigen)', nIds.includes(c2.id) && nIds.includes(c3.id) && nIds.includes(c4.id) && !nIds.includes(id1))
  check('P2: Kennzahlen (stats) vorhanden', qualified.stats && typeof qualified.stats.nachrecherche === 'number')
  // Sortierung „schlechteste Website zuerst“ (website_bad) liefert absteigendes Potenzial
  const sorted = (await (await fetch(`${BASE}/api/kundenfinder/companies?q=${T2}&sort=website_bad`)).json()).companies
  check('P2: Sortierung „schlechteste Website zuerst“ ist absteigend', sorted.length >= 2 && (sorted[0].websiteScore ?? 0) >= (sorted[sorted.length - 1].websiteScore ?? 0))
  // KI-Notiz: manuell bearbeiten wird durch recompute NICHT überschrieben
  await fetch(`${BASE}/api/kundenfinder/ai-note`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id1, action: 'save', note: 'MANUELL-' + T2 }) })
  await fetch(`${BASE}/api/kundenfinder/recompute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
  const c1b = (await getC(id1)).company
  check('P2: manuell bearbeitete KI-Notiz bleibt nach Recompute erhalten', c1b.aiWebsiteNote === 'MANUELL-' + T2 && c1b.aiNoteEdited === true)
  // „Neu generieren“ überschreibt die manuelle Notiz bewusst
  const regen = await (await fetch(`${BASE}/api/kundenfinder/ai-note`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id1, action: 'regenerate' }) })).json()
  check('P2: „Notiz neu generieren“ ersetzt die manuelle Notiz', regen.company?.aiWebsiteNote !== 'MANUELL-' + T2)
  // Aktivität dokumentieren
  await fetch(`${BASE}/api/kundenfinder/activity`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id1, type: 'angerufen', note: 'Test' }) })
  const withAct = await getC(id1)
  check('P2: Kontaktaktivität dokumentiert + last_activity gesetzt', (withAct.activities || []).length >= 1 && !!withAct.company.lastActivityAt)

  // ── Phase 3: Personen-/Entscheider-Recherche (Extraktion · Klassifizierung · Dedupe · bevorzugt · Sperre · Filter) ──
  console.log('\n── Phase 3: Personen- & Entscheider-Recherche ──')
  const T3 = TOKEN + 'p'
  const parse = async (payload) => (await fetch(`${BASE}/api/kundenfinder/people/parse`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })).json()
  const IMPRESSUM = [
    'Impressum',
    `Muster Elektro ${T3} GmbH`,
    'Musterstraße 5, 50667 Köln',
    'Geschäftsführer: Max Mustermann, Mobil (geschäftlich): 0171 2345678, E-Mail: max.mustermann@muster-elektro.de',
    'Telefon: 0221 5551234',
    'Telefax: 0221 5551299',
    'E-Mail: info@muster-elektro.de',
    'Ansprechpartnerin Marketing: Anna Schmidt, anna.schmidt@muster-elektro.de',
    'Verwaltung: Peter Klein'
  ].join('\n')

  // 1) Reine Extraktion (ohne Speichern)
  const ext = await parse({ text: IMPRESSUM, kind: 'impressum', sourceUrl: 'https://example.test/impressum' })
  const people = ext.extract?.people || []
  const findByName = (frag) => people.find((p) => p.fullName.toLowerCase().includes(frag))
  const max = findByName('mustermann')
  const anna = findByName('schmidt')
  const peter = findByName('klein')
  check('P3-1: Geschäftsführer als Person erkannt', !!max && /geschäftsführer/i.test(max.role || ''))
  check('P3-1: Geschäftsführer = sehr hohe Entscheidungsrelevanz + Entscheider', !!max && max.decisionRelevance === 'sehr_hoch' && max.isDecisionMaker === true && max.isManagingDirector === true)
  check('P3-1: Verwaltung = mittlere Relevanz (kein Entscheider)', !!peter && peter.decisionRelevance === 'mittel' && peter.isDecisionMaker === false)
  // 2) Telefon-/Mobil-Klassifizierung
  const maxMobile = (max?.contacts || []).find((c) => c.isMobile)
  check('P3-2: Mobilnummer dem Geschäftsführer zugeordnet + als geschäftlich eingestuft', !!maxMobile && maxMobile.phoneType === 'geschaeftlich_mobil' && maxMobile.mobileConfidence === 'geschaeftlich')
  const general = ext.extract?.generalContacts || []
  check('P3-2: Fax landet NICHT als Personen-Telefon, sondern als allgemeiner Kontakt', general.some((c) => c.phoneType === 'fax') && !(max?.contacts || []).some((c) => c.phoneType === 'fax'))
  check('P3-2: Festnetz-Zentrale ist allgemeiner Kontakt (nicht direkt einer Person)', general.some((c) => c.phoneType === 'zentrale' || c.phoneType === 'festnetz'))
  // 3) E-Mail-Zuordnung: generisch vs. Namens-E-Mail
  check('P3-3: generische info@ ist allgemeiner Kontakt (nicht Direktkontakt einer Person)', general.some((c) => c.kind === 'email' && c.value.startsWith('info@')))
  check('P3-3: Namens-E-Mail (anna.schmidt@) der Person zugeordnet', !!anna && (anna.contacts || []).some((c) => c.kind === 'email' && c.isDirect && c.value.startsWith('anna.schmidt@')))
  check('P3-3: KEINE E-Mail-Adressen aus Namensmustern erzeugt (nur vorhandene zugeordnet)', !(peter?.contacts || []).some((c) => c.kind === 'email'))

  // 4) Persistieren an ein Unternehmen → Rollups + bevorzugter Ansprechpartner
  const impComp = await imp([{ name: `${T3} Traeger GmbH`, plz: '50670', city: 'Köln', website: `https://${T3}.de`, source: 'osm' }])
  const compId = impComp.details[0].companyId
  const persisted = await parse({ text: IMPRESSUM, kind: 'impressum', sourceUrl: `https://${T3}.de/impressum`, companyId: compId, persist: true })
  const compAfter = persisted.company
  check('P3-4: Personen gespeichert (people_count > 0)', (persisted.people || []).length >= 3 && compAfter.peopleCount >= 3)
  check('P3-4: bevorzugter Ansprechpartner = Geschäftsführer', /mustermann/i.test(compAfter.preferredPersonName || ''))
  check('P3-4: Rollups gesetzt (Entscheider + geschäftl. Mobil vorhanden)', compAfter.hasDecisionMaker === true && compAfter.hasBusinessMobile === true && compAfter.hasDirectEmail === true)
  check('P3-4: KI-Zusammenfassung nur aus belegten Fakten', typeof persisted.summary === 'string' && /Mustermann/.test(persisted.summary) && /geprüft/.test(persisted.summary))

  // 5) Dedupe: gleiche Personen erneut einlesen → keine Duplikate
  const again = await parse({ text: IMPRESSUM, kind: 'impressum', sourceUrl: `https://${T3}.de/impressum`, companyId: compId, persist: true })
  check('P3-5: erneute Recherche legt keine doppelten Personen an', again.people.length === persisted.people.length)

  // 6) Filter: Direktkontakt/Entscheider/Preset finden das Unternehmen
  const q6 = async (qs) => (await (await fetch(`${BASE}/api/kundenfinder/companies?q=${T3}&${qs}`)).json()).companies.map((c) => c.id)
  check('P3-6: Filter „geschäftl. Mobil vorhanden“ findet das Unternehmen', (await q6('direct=mobile')).includes(compId))
  check('P3-6: Filter „Geschäftsführer gefunden“ findet das Unternehmen', (await q6('decider=md')).includes(compId))

  // 7) Sperrstatus „Kein Kontakt gewünscht“: Person bleibt erhalten, wird aber nicht mehr aktiv genutzt
  const maxId = persisted.people.find((p) => /mustermann/i.test(p.fullName)).id
  await fetch(`${BASE}/api/kundenfinder/person/${maxId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contactStatus: 'kein_kontakt' }) })
  const compBlocked = (await getC(compId)).company
  check('P3-7: gesperrte Person nicht mehr bevorzugt (Rollup neu berechnet)', !/mustermann/i.test(compBlocked.preferredPersonName || ''))
  check('P3-7: geschäftl. Mobil der gesperrten Person nicht mehr aktiv gewertet', compBlocked.hasBusinessMobile === false)
  const stillThere = (await getC(compId)).people.some((p) => /mustermann/i.test(p.fullName))
  check('P3-7: gesperrte Person bleibt als Sperreintrag erhalten (nicht erneut aufnehmbar)', stillThere === true)
} catch (e) {
  check('Testlauf ohne Abbruch', false, String(e))
} finally {
  // Aufräumen: alle Test-Unternehmen vollständig entfernen
  let removed = 0
  for (const id of created) {
    try { const r = await action('remove', id); if (r.ok) removed++ } catch {}
  }
  console.log(`\n(aufgeräumt: ${removed} Test-Unternehmen entfernt)`)
}

const pass = results.filter((r) => r.ok).length
console.log(`\n════ Kundenfinder: ${pass}/${results.length} bestanden ════`)
process.exit(pass === results.length ? 0 : 1)
