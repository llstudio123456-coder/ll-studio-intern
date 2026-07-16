/** Extrahiert dominante Marken-Farben aus einem hochgeladenen Logo (Client, Canvas). */
export async function extractLogoColors(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const w = 64
        const h = Math.max(1, Math.round((64 * img.height) / Math.max(1, img.width)))
        const cv = document.createElement('canvas')
        cv.width = w
        cv.height = h
        const ctx = cv.getContext('2d')
        if (!ctx) return resolve([])
        ctx.drawImage(img, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h).data
        const map = new Map<string, number>()
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          const qr = Math.round(data[i] / 24) * 24
          const qg = Math.round(data[i + 1] / 24) * 24
          const qb = Math.round(data[i + 2] / 24) * 24
          if (qr > 238 && qg > 238 && qb > 238) continue // near-white überspringen
          const key = `${qr},${qg},${qb}`
          map.set(key, (map.get(key) || 0) + 1)
        }
        const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')
        const satOf = (r: number, g: number, b: number) => {
          const mx = Math.max(r, g, b)
          const mn = Math.min(r, g, b)
          return mx === 0 ? 0 : (mx - mn) / mx
        }
        const cols = [...map.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k]) => {
            const [r, g, b] = k.split(',').map(Number)
            return { r, g, b, s: satOf(r, g, b) }
          })
        const saturated = cols.filter((c) => c.s > 0.22).slice(0, 3)
        const top = (saturated.length ? saturated : cols.slice(0, 3)).map((c) => toHex(c.r, c.g, c.b))
        resolve(Array.from(new Set(top)).slice(0, 4))
      } catch {
        resolve([])
      }
    }
    img.onerror = () => resolve([])
    img.src = dataUrl
  })
}
