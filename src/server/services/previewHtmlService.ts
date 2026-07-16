import type { GeneratedHomepageConcept, PreviewSection } from '@shared/types'

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const radiusPx = (r: GeneratedHomepageConcept['radius']) => (r === 'scharf' ? '0px' : r === 'rund' ? '22px' : '12px')
const padY = (s: GeneratedHomepageConcept['spacing']) => (s === 'kompakt' ? '52px' : s === 'großzügig' ? '104px' : '76px')

const isDark = (c: GeneratedHomepageConcept) => c.backgroundStyle === 'dark'

function logo(c: GeneratedHomepageConcept, centered = false): string {
  if (c.logoDataUrl) return `<img src="${c.logoDataUrl}" alt="${esc(c.companyName)}" style="height:40px;object-fit:contain" />`
  const ls = centered ? 'letter-spacing:.18em;text-transform:uppercase;font-size:18px' : 'font-size:22px;letter-spacing:-.01em'
  return `<span style="font-family:var(--preview-heading-font);font-weight:600;${ls}">${esc(c.logoText || c.companyName)}</span>`
}

/** Bildblock: echtes Kunden-Bild (Cover-Crop + ggf. Overlay) oder eleganter Platzhalter. */
function imageBlock(c: GeneratedHomepageConcept, h: string, label: string, url?: string): string {
  if (url) {
    const overlay = isDark(c) ? `<div style="position:absolute;inset:0;background:var(--preview-overlay)"></div>` : ''
    return `<div style="border-radius:var(--preview-radius);position:relative;height:${h};overflow:hidden;background:var(--preview-surface)"><img src="${esc(url)}" alt="${esc(label)}" style="width:100%;height:100%;object-fit:cover;display:block" />${overlay}</div>`
  }
  const bg = isDark(c)
    ? `background:radial-gradient(130% 120% at 72% 18%, color-mix(in srgb, var(--preview-accent) 26%, transparent), transparent 55%), linear-gradient(155deg,#2c2430,#141017);`
    : `background:radial-gradient(130% 120% at 72% 18%, color-mix(in srgb, var(--preview-accent) 14%, transparent), transparent 55%), linear-gradient(155deg, var(--preview-surface), var(--preview-line));`
  const txt = isDark(c) ? 'color:rgba(243,236,225,.62)' : 'color:var(--preview-muted)'
  return `<div style="border-radius:var(--preview-radius);${bg}height:${h};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;${txt};overflow:hidden">
    <span style="font-family:var(--preview-heading-font);font-size:15px;letter-spacing:.04em">${esc(label)}</span>
    <span style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.7">Foto-Platzhalter</span>
  </div>`
}

function navLinks(c: GeneratedHomepageConcept, onDark: boolean): string {
  const col = onDark ? 'color:rgba(243,236,225,.86)' : 'color:var(--preview-text)'
  return c.navItems.map((n) => `<span style="${col};font-size:13.5px;letter-spacing:.02em">${esc(n)}</span>`).join('')
}

function btnAccent(label: string, attr = ''): string {
  return `<a${attr} class="llcta" style="display:inline-block;background:var(--preview-cta);color:var(--preview-accent-ink);padding:13px 28px;border-radius:999px;font-weight:600;letter-spacing:.01em;text-decoration:none">${esc(label)}</a>`
}
function btnOutline(label: string, onDark: boolean): string {
  const c = onDark ? 'rgba(243,236,225,.9)' : 'var(--preview-text)'
  return `<a style="display:inline-block;border:1px solid ${onDark ? 'rgba(243,236,225,.4)' : 'var(--preview-line)'};color:${c};padding:12px 26px;border-radius:999px;font-weight:500;text-decoration:none">${esc(label)}</a>`
}

function section(s: PreviewSection, c: GeneratedHomepageConcept, i: number, editable: boolean): string {
  const de = (f: string) => (editable ? ` data-edit="${i}:${f}"` : '')
  const itemT = (j: number, t: string) => (editable ? ` data-edit="${i}:item:${j}:title"` : '') + `>${esc(t)}`
  const itemX = (j: number, t = '') => (editable ? ` data-edit="${i}:item:${j}:text"` : '') + `>${esc(t)}`
  const dark = isDark(c)
  const wrap = (inner: string, bg = 'var(--preview-bg)') => `<section style="padding:var(--preview-spacing) 24px;background:${bg}"><div style="max-width:1120px;margin:0 auto">${inner}</div></section>`
  const eyebrow = (t?: string) => (t ? `<div${de('eyebrow')} style="font-size:12px;letter-spacing:.26em;text-transform:uppercase;color:var(--preview-accent);margin-bottom:14px">${esc(t)}</div>` : '')
  const h2 = (t?: string) => (t ? `<h2${de('heading')} style="font-family:var(--preview-heading-font);font-size:34px;letter-spacing:-.01em;margin:0 0 10px">${esc(t)}</h2>` : '')
  const sub = (t?: string) => (t ? `<p${de('subheading')} style="color:var(--preview-muted);margin:0 0 30px;font-size:16.5px;max-width:640px">${esc(t)}</p>` : '')
  const cardCss = `background:var(--preview-surface);border:1px solid var(--preview-line);border-radius:var(--preview-radius)${dark ? '' : ';box-shadow:0 8px 30px rgba(0,0,0,.05)'}`

  switch (s.type) {
    case 'header': {
      if (c.overlay && c.heroType === 'cinematic-full') return ''
      const shell = 'position:sticky;top:0;z-index:20;background:color-mix(in srgb, var(--preview-bg) 86%, transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--preview-line)'
      const navCta = c.navHasCta ? btnAccent('Kontakt') : ''
      // Logo mittig (aus B): Logo zentriert, Nav darunter
      if (c.logoCenter) {
        return `<header style="${shell}"><div style="max-width:1120px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 24px"><div style="display:flex;align-items:center;gap:16px">${logo(c, true)}${navCta}</div><nav style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center">${navLinks(c, false)}</nav></div></header>`
      }
      return `<header style="${shell}"><div style="max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:22px;padding:16px 24px">${logo(c)}<nav style="margin-left:auto;display:flex;gap:24px">${navLinks(c, false)}</nav>${navCta}</div></header>`
    }

    case 'hero': {
      const heroLabel = s.imageLabels?.[0] || 'Bild'
      const align = c.heroAlign || 'center'
      const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
      const marginX = align === 'center' ? '0 auto' : '0'
      if (c.heroType === 'cinematic-full') {
        const bg = s.imageUrl
          ? `background:#100d12 center/cover no-repeat url('${esc(s.imageUrl)}')`
          : `background:radial-gradient(120% 130% at 70% 15%, color-mix(in srgb, var(--preview-accent) 22%, transparent), transparent 55%), linear-gradient(155deg,#2b2330,#100d12)`
        // Nav über Bild folgt der Logo-Position aus B (links vs. zentriert)
        const navOver = c.overlay
          ? c.logoCenter
            ? `<div style="position:absolute;top:0;left:0;right:0;z-index:3;display:flex;flex-direction:column;align-items:center;gap:14px;padding:26px 24px"><div>${logo(c, true)}</div><nav style="display:flex;gap:26px;flex-wrap:wrap;justify-content:center">${navLinks(c, true)}</nav></div>`
            : `<div style="position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:center;gap:22px;padding:24px">${logo(c)}<nav style="margin-left:auto;display:flex;gap:24px;flex-wrap:wrap">${navLinks(c, true)}</nav>${c.navHasCta ? btnAccent('Reservieren') : ''}</div>`
          : ''
        const arrows = c.imageHeavy
          ? `<div style="position:absolute;bottom:26px;right:26px;z-index:3;display:flex;gap:10px"><span style="width:42px;height:42px;border:1px solid rgba(243,236,225,.4);border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(243,236,225,.8)">‹</span><span style="width:42px;height:42px;border:1px solid rgba(243,236,225,.4);border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(243,236,225,.8)">›</span></div>`
          : ''
        const hero = `<section style="position:relative;min-height:640px;display:flex;align-items:center;justify-content:${justify};text-align:${align};overflow:hidden;${bg}">
          <div style="position:absolute;inset:0;background:var(--preview-overlay)"></div>${navOver}
          <div style="position:relative;z-index:4;max-width:760px;padding:0 40px;color:#f4ede2">
            ${s.eyebrow ? `<div${de('eyebrow')} style="font-size:12.5px;letter-spacing:.32em;text-transform:uppercase;color:var(--preview-accent);margin-bottom:20px">${esc(s.eyebrow)}</div>` : ''}
            <h1${de('heading')} style="font-family:var(--preview-heading-font);font-weight:600;font-size:clamp(40px,6vw,72px);line-height:1.04;letter-spacing:-.01em;margin:0 0 18px;color:#f7f1e7">${esc(s.heading)}</h1>
            <p${de('subheading')} style="color:rgba(243,236,225,.85);font-size:18px;max-width:560px;margin:${marginX};margin-bottom:28px">${esc(s.subheading)}</p>
            <div style="display:flex;gap:14px;justify-content:${justify};flex-wrap:wrap">${btnAccent(s.ctaLabel || 'Tisch reservieren', de('ctaLabel'))}${btnOutline('Speisekarte', true)}</div>
          </div>${arrows}
        </section>`
        const bar = `<div style="background:var(--preview-surface);border-bottom:1px solid var(--preview-line)"><div style="max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:16px 24px"><span style="color:var(--preview-muted);font-size:14px;letter-spacing:.02em">Geöffnet · Reservierung empfohlen</span><span style="margin-left:auto">${btnAccent(s.ctaLabel || 'Tisch reservieren')}</span></div></div>`
        return hero + bar
      }
      if (c.heroType === 'split-image') {
        // Bildseite folgt der Textausrichtung aus B: rechtsbündig → Bild links, sonst Bild rechts
        const imgLeft = align === 'right'
        const textCol = `<div>${eyebrow(s.eyebrow)}<h1${de('heading')} style="font-family:var(--preview-heading-font);font-size:clamp(34px,4.6vw,56px);line-height:1.06;letter-spacing:-.02em;margin:0 0 16px">${esc(s.heading)}</h1><p${de('subheading')} style="color:var(--preview-muted);font-size:18px;margin:0">${esc(s.subheading)}</p><div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">${btnAccent(s.ctaLabel || 'Anfragen', de('ctaLabel'))}${btnOutline('Mehr erfahren', dark)}</div></div>`
        const imgCol = imageBlock(c, '420px', heroLabel, s.imageUrl)
        const cols = imgLeft ? `1fr 1.1fr` : `1.05fr .95fr`
        return wrap(
          `<div style="display:grid;grid-template-columns:${cols};gap:44px;align-items:center">${imgLeft ? imgCol + textCol : textCol + imgCol}</div>`
        )
      }
      return wrap(
        `<div style="text-align:${align};max-width:760px;margin:${marginX}">${eyebrow(s.eyebrow)}<h1${de('heading')} style="font-family:var(--preview-heading-font);font-size:clamp(36px,5vw,60px);line-height:1.05;letter-spacing:-.02em;margin:0 0 16px">${esc(s.heading)}</h1><p${de('subheading')} style="color:var(--preview-muted);font-size:18px;margin:${marginX}">${esc(s.subheading)}</p>${s.ctaLabel ? `<div style="margin-top:22px;display:flex;justify-content:${justify}">${btnAccent(s.ctaLabel, de('ctaLabel'))}</div>` : ''}</div>`
      )
    }

    case 'trust':
      return `<section style="padding:24px;background:${dark ? 'var(--preview-surface)' : 'var(--preview-text)'}"><div style="max-width:1120px;margin:0 auto;display:flex;flex-wrap:wrap;gap:42px;justify-content:center;color:${dark ? 'var(--preview-text)' : 'var(--preview-bg)'}">${(s.items || [])
        .map((it, j) => `<div style="text-align:center"><div style="font-weight:700;color:var(--preview-accent)"${itemT(j, it.title)}</div><div style="opacity:.72;font-size:13px"${itemX(j, it.text)}</div></div>`)
        .join('')}</div></section>`

    case 'menu':
      return wrap(
        `<div style="text-align:center;margin-bottom:34px">${eyebrow(s.eyebrow)}${h2(s.heading)}<p style="color:var(--preview-muted);margin:0 auto;max-width:560px">${esc(s.subheading || '')}</p></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px">${(s.items || [])
          .map((it, j) => `<div style="${cardCss};padding:22px;display:flex;gap:16px;align-items:flex-start"><div style="width:54px;height:54px;border-radius:var(--preview-radius);background:linear-gradient(140deg, color-mix(in srgb,var(--preview-accent) 30%, transparent), transparent);flex:0 0 auto"></div><div><h3 style="font-family:var(--preview-heading-font);font-size:20px;margin:0 0 4px"${itemT(j, it.title)}</h3><p style="color:var(--preview-muted);font-size:14px;margin:0"${itemX(j, it.text)}</p></div></div>`)
          .join('')}</div>${s.ctaLabel ? `<div style="text-align:center;margin-top:26px">${btnOutline(s.ctaLabel, dark)}</div>` : ''}`,
        dark ? 'var(--preview-bg)' : 'var(--preview-surface)'
      )

    case 'services':
      return wrap(
        `${eyebrow('Angebot')}${h2(s.heading)}${sub(s.subheading)}<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">${(s.items || [])
          .map((it, j) => `<div style="${cardCss};padding:24px"><div style="width:42px;height:42px;border-radius:10px;background:color-mix(in srgb,var(--preview-accent) 22%, transparent);margin-bottom:14px"></div><h3 style="font-family:var(--preview-heading-font);font-size:19px;margin:0 0 6px"${itemT(j, it.title)}</h3><p style="color:var(--preview-muted);font-size:14px;margin:0"${itemX(j, it.text)}</p></div>`)
          .join('')}</div>`,
        dark ? 'var(--preview-surface)' : 'var(--preview-bg)'
      )

    case 'about':
      return wrap(
        `<div style="display:grid;grid-template-columns:.9fr 1.1fr;gap:44px;align-items:center">${imageBlock(c, '300px', s.imageLabels?.[0] || 'Über uns', s.imageUrl)}<div>${eyebrow(s.eyebrow)}${h2(s.heading)}<p${de('body')} style="color:var(--preview-muted);font-size:16.5px;line-height:1.7">${esc(s.body)}</p>${s.ctaLabel ? `<div style="margin-top:20px">${btnOutline(s.ctaLabel, dark)}</div>` : ''}</div></div>`
      )

    case 'benefits':
      return wrap(
        `${h2(s.heading)}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${(s.items || [])
          .map((it, j) => `<div style="${cardCss};padding:20px"><h3 style="font-size:16px;margin:0 0 6px"${itemT(j, it.title)}</h3><p style="color:var(--preview-muted);font-size:13px;margin:0"${itemX(j, it.text)}</p></div>`)
          .join('')}</div>`,
        dark ? 'var(--preview-surface)' : 'var(--preview-bg)'
      )

    case 'gallery': {
      const real = s.imageUrls && s.imageUrls.length ? s.imageUrls : null
      const cells = real
        ? real.slice(0, 6).map((u) => imageBlock(c, '210px', 'Foto', u)).join('')
        : (s.imageLabels?.length ? s.imageLabels : ['Foto', 'Foto', 'Foto']).slice(0, 6).map((l) => imageBlock(c, '210px', l)).join('')
      return wrap(
        `<div style="text-align:center;margin-bottom:30px">${eyebrow(s.eyebrow)}${h2(s.heading)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">${cells}</div><p style="color:var(--preview-muted);font-size:12px;margin-top:12px;text-align:center">${esc(s.note || '')}</p>`
      )
    }

    case 'reviews':
      return wrap(
        `${h2(s.heading)}<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px">${(s.items || [])
          .map((it, j) => `<div style="${cardCss};padding:24px"><div style="color:var(--preview-accent);letter-spacing:.1em">${esc(it.title)}</div><p style="margin:10px 0 0;font-size:15px"${itemX(j, it.text)}</p></div>`)
          .join('')}</div>`,
        dark ? 'var(--preview-bg)' : 'var(--preview-surface)'
      )

    case 'contact':
      return `<section style="padding:var(--preview-spacing) 24px;background:${dark ? 'var(--preview-surface)' : 'var(--preview-text)'};color:${dark ? 'var(--preview-text)' : 'var(--preview-bg)'}"><div style="max-width:1120px;margin:0 auto;text-align:center"><div${de('eyebrow')} style="font-size:12px;letter-spacing:.26em;text-transform:uppercase;color:var(--preview-accent);margin-bottom:14px">${esc(s.eyebrow || 'Kontakt')}</div><h2${de('heading')} style="font-family:var(--preview-heading-font);font-size:34px;margin:0 0 10px">${esc(s.heading)}</h2><p${de('subheading')} style="opacity:.78;margin:0 auto 24px;max-width:560px">${esc(s.subheading)}</p>${btnAccent(s.ctaLabel || 'Kontakt', de('ctaLabel'))}</div></section>`

    case 'footer': {
      const cols = c.footerColumns || 1
      // Mehrspaltiger Footer (aus B): Marke + Spalten mit Platzhalter-Links
      if (cols >= 2) {
        const colTitles = ['Navigation', 'Kontakt', 'Öffnungszeiten', 'Rechtliches', 'Social', 'Service']
        const colCells = Array.from({ length: Math.min(cols, 4) }, (_, k) =>
          `<div><div style="font-family:var(--preview-heading-font);font-size:14px;margin-bottom:10px">${colTitles[k]}</div><div style="color:var(--preview-muted);font-size:13px;line-height:1.9">[Platzhalter]<br>[Platzhalter]</div></div>`
        ).join('')
        return `<footer style="background:var(--preview-bg);border-top:1px solid var(--preview-line);padding:44px 24px 30px"><div style="max-width:1120px;margin:0 auto"><div style="display:grid;grid-template-columns:1.4fr repeat(${Math.min(cols, 4)},1fr);gap:28px"><div>${logo(c)}<p style="color:var(--preview-muted);font-size:13px;margin:12px 0 0;max-width:240px">[Platzhalter: kurzer Markensatz.]</p></div>${colCells}</div><div style="margin-top:28px;padding-top:18px;border-top:1px solid var(--preview-line);color:var(--preview-muted);font-size:12px">© ${new Date().getFullYear()} ${esc(c.companyName)} · Impressum · Datenschutz [Platzhalter]</div></div></footer>`
      }
      return `<footer style="background:var(--preview-bg);border-top:1px solid var(--preview-line);padding:34px 24px"><div style="max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:16px;color:var(--preview-muted);font-size:13px;flex-wrap:wrap">${logo(c)}<span style="margin-left:auto">© ${new Date().getFullYear()} ${esc(c.companyName)} · Impressum · Datenschutz [Platzhalter]</span></div></footer>`
    }

    default:
      return ''
  }
}

const EDIT_SCRIPT = `<script>
(function(){
  document.querySelectorAll('[data-edit]').forEach(function(el){
    el.setAttribute('contenteditable','true'); el.style.cursor='text'; el.style.borderRadius='4px';
    el.addEventListener('mouseenter',function(){ if(document.activeElement!==el) el.style.boxShadow='0 0 0 1px var(--preview-accent)'; });
    el.addEventListener('mouseleave',function(){ if(document.activeElement!==el) el.style.boxShadow='none'; });
    el.addEventListener('focus',function(){ el.style.boxShadow='0 0 0 2px var(--preview-accent)'; });
    el.addEventListener('blur',function(){ el.style.boxShadow='none'; });
    el.addEventListener('input',function(){ parent.postMessage({__llEdit:true, path:el.getAttribute('data-edit'), value:el.innerText},'*'); });
    el.addEventListener('keydown',function(e){ if(e.key==='Enter'&&el.tagName!=='P'){ e.preventDefault(); el.blur(); } });
  });
})();
</script>`

/** Vollständiges, eigenständiges HTML der Konzept-Startseite (Export, PNG & Inline-Editing). */
export function renderPreviewHtml(c: GeneratedHomepageConcept, editable = false): string {
  const headingFont = c.typography === 'serif-display' ? "'Cormorant Garamond', Georgia, serif" : "'Inter', system-ui, sans-serif"
  const p = c.palette
  const vars = [
    `--preview-primary:${p.primary}`,
    `--preview-secondary:${p.secondary}`,
    `--preview-cta:${p.cta}`,
    `--preview-cta-hover:${p.ctaHover}`,
    `--preview-bg:${p.paper}`,
    `--preview-surface:${p.surface}`,
    `--preview-text:${p.ink}`,
    `--preview-accent:${p.accent}`,
    `--preview-accent-ink:${p.accentInk}`,
    `--preview-muted:${p.muted}`,
    `--preview-border:${p.line}`,
    `--preview-line:${p.line}`,
    `--preview-overlay:${p.overlay}`,
    `--preview-radius:${radiusPx(c.radius)}`,
    `--preview-spacing:${padY(c.spacing)}`,
    `--preview-heading-font:${headingFont}`,
    `--preview-body-font:'Inter', system-ui, sans-serif`
  ].join(';')
  const body = c.sections.map((s, i) => section(s, c, i, editable)).join('\n')
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>:root{${vars}}*{box-sizing:border-box}body{margin:0;font-family:var(--preview-body-font);color:var(--preview-text);background:var(--preview-bg)}h1,h2,h3{font-family:var(--preview-heading-font);font-weight:600}a{cursor:pointer}.llcta{transition:background .15s}.llcta:hover{background:var(--preview-cta-hover)!important}@media(max-width:760px){section>div[style*="grid-template-columns"]{grid-template-columns:1fr!important}}</style>
</head><body>${body}${editable ? EDIT_SCRIPT : ''}</body></html>`
}
