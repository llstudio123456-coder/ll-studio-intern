/**
 * LL Studio Inspector — zentrale Typdefinitionen.
 * Werden sowohl im Main-Prozess (Node/Playwright) als auch im Renderer (React) genutzt.
 */

export type DesignStyle =
  | 'modern'
  | 'clean'
  | 'premium'
  | 'handwerklich'
  | 'elegant'
  | 'luxuriös'
  | 'minimalistisch'
  | 'verspielt'
  | 'technisch'
  | 'unbekannt'

export type Tonality =
  | 'sachlich'
  | 'freundlich'
  | 'premium'
  | 'emotional'
  | 'technisch'
  | 'verkäuferisch'
  | 'unbekannt'

/** Erkannte Funktionen / Besonderheiten einer Webseite. */
export interface WebsiteFeatures {
  contactForm: boolean
  onlineBooking: boolean
  whatsapp: boolean
  phoneClickToCall: boolean
  reviews: boolean
  beforeAfter: boolean
  faq: boolean
  career: boolean
  gallery: boolean
  newsletter: boolean
  liveChat: boolean
  multiLanguage: boolean
  cookieBanner: boolean
}

/** Eine erkannte Unterseite / Navigationspunkt. */
export interface DetectedPage {
  label: string
  url: string
  type:
    | 'home'
    | 'services'
    | 'about'
    | 'contact'
    | 'gallery'
    | 'references'
    | 'team'
    | 'career'
    | 'blog'
    | 'pricing'
    | 'legal'
    | 'other'
}

export interface ColorInfo {
  hex: string
  /** grobe Rolle, soweit ableitbar */
  role?: 'background' | 'text' | 'accent' | 'surface'
  /** Häufigkeit/Gewicht 0..1 */
  weight?: number
}

/** Gemeinsame Basis: was wir von JEDER analysierten Seite extrahieren. */
export interface WebsiteSnapshot {
  url: string
  finalUrl: string
  domain: string
  reachable: boolean
  blocked: boolean
  error?: string
  fetchedAt: string

  companyName?: string
  title?: string
  metaDescription?: string

  industry?: string
  industryConfidence?: number
  services: string[]
  location?: string
  targetAudience?: string

  tonality: Tonality
  designStyle: DesignStyle
  colors: ColorInfo[]

  pages: DetectedPage[]
  features: WebsiteFeatures

  /** technische Kennzahlen, soweit lokal messbar */
  metrics: WebsiteMetrics

  screenshotDesktop?: string // Dateipfad
  screenshotMobile?: string // Dateipfad

  /** kurze, automatisch extrahierte Textauszüge (Hero, Headings) */
  headings: string[]
  heroText?: string
  wordCount: number
}

export interface WebsiteMetrics {
  loadMs?: number
  domNodes?: number
  imageCount?: number
  largeImageCount?: number
  hasViewportMeta: boolean
  httpsValid: boolean
  hasFavicon: boolean
  textToHtmlRatio?: number
}

/** Schritt 2: Analyse der eingegebenen Ziel-Webseite. */
export interface TargetWebsiteAnalysis extends WebsiteSnapshot {
  /** automatisch erkannte Schwächen der Zielseite */
  weaknesses: string[]
  /** Stärken */
  strengths: string[]
  /** Suchstandort, falls aus Seite/Eingabe ableitbar */
  resolvedLocation?: string
}

/** Schritt 3: generierte Suchanfrage (ohne Search-API). */
export interface SearchQuery {
  id: string
  query: string
  rationale: string
  /** vorbereitete URLs zum manuellen Öffnen, falls Auto-Scrape blockiert */
  manualSearchUrls: { engine: string; url: string }[]
}

/** Ergebnis einer lokalen Browser-Suche (Playwright). */
export interface LocalBrowserSearchResult {
  query: string
  engine: string
  success: boolean
  blocked: boolean
  error?: string
  candidates: CompetitorCandidate[]
}

/** Schritt 3/4: ein möglicher Mitbewerber-Kandidat. */
export interface CompetitorCandidate {
  url: string
  domain: string
  title?: string
  snippet?: string
  source: 'search' | 'manual'
  foundVia?: string // query oder "manuell"
  /** wird nach Analyse gesetzt */
  analyzed: boolean
}

/** vom Nutzer manuell hinzugefügter Link. */
export interface ManualUrlInput {
  url: string
  note?: string
}

/** Score 0..100 mit Teilbewertungen. */
export interface WebsiteScore {
  total: number // 0..100
  breakdown: {
    designQuality: number
    modernity: number
    mobile: number
    structure: number
    callToActions: number
    imagery: number
    styleFit: number
    trustSignals: number
    performance: number
    inspirationValue: number
  }
  notes: string[]
}

/** Schritt 4/5: vollständige Analyse + Bewertung eines Mitbewerbers. */
export interface CompetitorAnalysis {
  id: string
  snapshot: WebsiteSnapshot
  score: WebsiteScore

  shortDescription: string
  whyInspiring: string
  strongElements: string[]
  ideasToAdopt: string[]
  doNotCopyWarning: string

  source: 'search' | 'manual'
  foundVia?: string

  /** nur im Inspiration-Such-Modus gesetzt */
  queryRelevance?: number
  whyMatches?: string
}

/** Schritt 6: gemeinsame Inspirations-Auswertung. */
export interface InspirationReport {
  generatedAt: string
  aiUsed: boolean
  recommendedDesignDirection: string
  mustHavePages: string[]
  homepageContent: string[]
  recommendedCtas: string[]
  colorAndLayoutIdeas: string[]
  recommendedFeatures: string[]
  bestDesignReferences: { id: string; domain: string; reason: string }[]
  bestForContentOrTrust: { id: string; domain: string; reason: string }[]
  targetMistakesVsCompetitors: string[]
  disclaimer: string
}

/** Konfiguration eines Analyse-Laufs (aus der UI). */
export interface RunConfig {
  url: string
  maxResults: number
  country?: string
  region?: string
  radius?: string
  style?: DesignStyle | string
  industryOverride?: string
  manualUrls: ManualUrlInput[]
  /** nur generierte Queries anzeigen, keine Auto-Suche (Fallback-Modus) */
  manualSearchOnly?: boolean
  headless?: boolean
}

/** Vollständiges, persistierbares Projekt-Ergebnis. */
export interface AnalysisProject {
  id: string
  createdAt: string
  config: RunConfig
  target: TargetWebsiteAnalysis
  queries: SearchQuery[]
  searchResults: LocalBrowserSearchResult[]
  competitors: CompetitorAnalysis[]
  report: InspirationReport
  aiUsed: boolean
}

/** Fortschritts-Events vom Main-Prozess an die UI. */
export type PipelinePhase =
  | 'init'
  | 'target'
  | 'queries'
  | 'search'
  | 'collect'
  | 'analyze-competitors'
  | 'scoring'
  | 'report'
  | 'done'
  | 'error'

export interface ProgressEvent {
  phase: PipelinePhase
  message: string
  /** 0..100 */
  percent: number
  /** aktuell verarbeitete URL/Domain, falls relevant */
  current?: string
  /** Teil-Ergebnisse, die die UI inkrementell anzeigen kann */
  partialCompetitor?: CompetitorAnalysis
  partialTarget?: TargetWebsiteAnalysis
  partialQueries?: SearchQuery[]
}

export interface AiStatus {
  configured: boolean
  provider?: string
  model?: string
  reachable?: boolean
}

/** Export-Format. */
export type ExportFormat = 'json' | 'csv' | 'pdf'

/* ───────────────────────────── Inspiration-Such-Modus ───────────────────────────── */

export type SearchProviderName = 'brave' | 'serpapi' | 'tavily' | 'local' | 'manual'

export type SortMode = 'score' | 'aesthetic' | 'modern' | 'structure' | 'mobile' | 'inspiration' | 'relevance'

/** Auswahl aus dem geführten Such-Wizard / den Kategorie-Buttons. */
export interface InspirationCategories {
  industry?: string
  styles: string[]
  goals: string[]
  features: string[]
  region?: string
  country?: string
}

/** Konfiguration einer Inspirations-Suche (freier Text und/oder Kategorien). */
export interface InspirationSearchConfig {
  query?: string
  categories?: InspirationCategories
  maxResults: number
  country?: string
  region?: string
  manualUrls: ManualUrlInput[]
  manualSearchOnly?: boolean
  sort?: SortMode
  headless?: boolean
}

/** Rohergebnis eines Such-Providers (vor Analyse). */
export interface ProviderRawResult {
  url: string
  title?: string
  snippet?: string
  provider: SearchProviderName
  query: string
}

export interface ProviderRunInfo {
  provider: SearchProviderName
  query: string
  success: boolean
  blocked: boolean
  count: number
  error?: string
}

/** Persistiertes Ergebnis einer Inspirations-Suche. */
export interface InspirationSearchProject {
  id: string
  createdAt: string
  mode: 'search'
  config: InspirationSearchConfig
  detected: { industry?: string; styles: string[]; region?: string; language: string }
  /** erkannte Ziel-Branchenfamilie (Gate) + Herkunft (URL/Query/Kategorie) */
  targetFamily?: string
  targetFamilyLabel?: string
  queries: SearchQuery[]
  providerRuns: ProviderRunInfo[]
  results: CompetitorAnalysis[]
  /** wegen falscher Branche/Plattform ausgeblendete Kandidaten */
  rejected?: { domain: string; url: string; reason: string; industry?: string }[]
  /** Hinweise zur Suche (z. B. wenige passende Treffer) */
  searchWarnings?: string[]
  report: InspirationReport
  aiUsed: boolean
  providersUsed: SearchProviderName[]
}

export interface AiStatusFull extends AiStatus {
  searchProvidersConfigured: SearchProviderName[]
}

/* ───────────────────────────── Prompt-Generator ───────────────────────────── */

export type PromptPlatform =
  | 'claude-code'
  | 'lovable'
  | 'cursor'
  | 'generic-builder'
  | 'html-css-js'
  | 'nextjs-tailwind'

export type PromptType =
  | 'full-rebuild'
  | 'homepage'
  | 'landing'
  | 'redesign'
  | 'content-structure'
  | 'design-system'

/** Referenz-Website A (Stilvorlage) – möglichst aus vorhandener Analyse befüllt. */
export interface InspirationReference {
  url?: string
  companyName?: string
  industry?: string
  designStyle?: string
  colors: string[]
  score?: number
  /** optischer Score (Design-Qualität) – für die Design-Vorschau-Freigabe (>=75) */
  visualScore?: number
  usefulSections: string[]
  features: string[]
  whyInspiring?: string
  screenshot?: string
  /** stammt aus einer echten Analyse (true) oder nur aus manueller Eingabe (false) */
  fromAnalysis: boolean
}

/** Ziel-Unternehmen B. */
export interface TargetCompanyBrief {
  companyName: string
  url?: string
  industry?: string
  location?: string
  services?: string
  targetGroup?: string
  goal?: string
  preferredPages?: string[]
  notes?: string
  hasLogo?: boolean
  assetsNote?: string
}

export interface PromptGenerationInput {
  inspiration: InspirationReference
  target: TargetCompanyBrief
  promptType: PromptType
  platform: PromptPlatform
  /** Ziel-URL (falls vorhanden) zusätzlich analysieren */
  analyzeTargetUrl?: boolean
  projectId?: string
}

export interface PromptGenerationResult {
  prompt: string
  summary: {
    inspirationSource: string
    targetCompany: string
    styleDirection: string
    recommendedPages: string[]
    mainCta: string
    warnings: string[]
  }
  targetAnalysis?: {
    reachable: boolean
    strengths: string[]
    weaknesses: string[]
    keepContent: string[]
  }
  meta: { promptType: PromptType; platform: PromptPlatform; generatedAt: string; aiUsed: boolean }
}

export interface SavedPrompt {
  id: string
  title: string
  targetCompany: string
  inspirationSource: string
  promptType: PromptType
  platform: PromptPlatform
  createdAt: string
  promptText: string
  projectId?: string
  summary?: PromptGenerationResult['summary']
}

/* ───────────────────────────── Design-Vorschau / Stil-Vorschau ───────────────────────────── */

/** Kunde A (für den die Vorschau erstellt wird). */
export interface SourceCompany {
  name: string
  url?: string
  industry?: string
  location?: string
  services: string[]
  targetGroup?: string
  brandFeeling?: string
  /** manuell eingegebene Marken-Farben (höchste Priorität) */
  colors: string[]
  /** automatisch aus dem Logo extrahiert (Client) */
  logoColors?: string[]
  /** Farben der bestehenden Website von A (aus Analyse) */
  websiteColors?: string[]
  logoDataUrl?: string
  screenshot?: string
  /** echte Bilder von der Website von A (aus Analyse) */
  websiteImages?: ExtractedWebsiteImage[]
  /** zuverlässig erkannte Markenfarben (CSS-Vars/Buttons/Nav/Logo) inkl. Confidence */
  detectedColors?: DetectedColor[]
  /** Cookie-/Widget-Farben wurden bei der Erkennung bewusst ausgeschlossen */
  cookieFiltered?: boolean
  weaknesses?: string[]
  fromAnalysis?: boolean
}

/* ── Bild-Transfer (echte Bilder von Kunde A) ── */
export type ImageRole = 'hero' | 'section' | 'gallery' | 'card' | 'background' | 'fallback'

export interface ExtractedWebsiteImage {
  url: string
  width?: number
  height?: number
  area?: number
  alt?: string
  role: ImageRole
  quality: number
}

export interface PreviewImagePlacement {
  section: PreviewSectionType
  url: string
  role: ImageRole
  treatment: string
}

export interface ImageFitScore {
  score: number
  notes: string[]
}

/* ── Brand-/Farb-Transfer ── */
export type ColorRole = 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text' | 'muted' | 'border' | 'cta' | 'ctaHover'

export type ColorSource =
  | 'manual'
  | 'logo'
  | 'css-var'
  | 'button'
  | 'cta'
  | 'nav'
  | 'link'
  | 'header'
  | 'footer'
  | 'section-bg'
  | 'text'
  | 'border'
  | 'background'
  | 'screenshot'
  | 'cookie-banner'
  | 'third-party-widget'
  | 'image'
  | 'unknown'

/** Eine erkannte Kundenfarbe inkl. Quelle, Confidence und Rollen-Vorschlag. */
export interface DetectedColor {
  hex: string
  source: ColorSource
  confidence: number
  role: ColorRole
  count?: number
  /** sichtbare Fläche (px²), auf der die Farbe vorkommt */
  area?: number
  /** auf wie vielen gecrawlten Seiten die Farbe vorkommt */
  pages?: number
  /** Beispiel-Selektor/Element */
  selector?: string
  include: boolean
  reason?: string
}

/** Abgelehnte Farbe mit Begründung (Audit). */
export interface RejectedColor {
  hex: string
  source: ColorSource
  reason: string
}

/** Ergebnis der vollständigen Farbanalyse von Kunde A. */
export interface PaletteAuditResult {
  url: string
  pagesCrawled: string[]
  candidates: DetectedColor[]
  rejected: RejectedColor[]
  /** finale Rollen-Zuordnung (hex je Rolle, soweit belegbar) */
  roles: Partial<Record<ColorRole, string>>
  /** Gesamt-Vertrauen in die Erkennung 0..100 */
  overallConfidence: number
  cookieFiltered: boolean
  logs: string[]
}

export type PaletteApplicationMode = 'reference-keep' | 'customer-accent' | 'customer-strong' | 'customer-only' | 'auto'

export interface SavedProjectPalette {
  projectId: string
  updatedAt: string
  colors: string[]
  detected?: DetectedColor[]
  palette?: PreviewPalette
}

export type BrandTransferMode = 'customer-priority' | 'reference-priority' | 'balanced' | 'customer-only' | 'reference-only' | 'auto'

/** Markenprofil von Kunde A (aus manuell/Logo/Website abgeleitet). */
export interface BrandProfile {
  primary: string
  secondary: string
  accent: string
  neutralDark: string
  neutralLight: string
  text: string
  button: string
  hover: string
  border: string
  source: 'manual' | 'logo' | 'website' | 'mixed' | 'default'
  sourceNotes: string[]
}

export interface BrandAssets {
  logoDataUrl?: string
  logoText: string
  colors: string[]
}

/** Visuelle Layout-Archetypen für den Stil-Transfer. */
export type StyleArchetype =
  | 'dark-cinematic-restaurant'
  | 'light-premium-restaurant'
  | 'minimalist-agency'
  | 'luxury-service'
  | 'modern-local-business'
  | 'craftsman-trust'
  | 'medical-clean'
  | 'automotive-premium'
  | 'generic'

export type HeroType = 'cinematic-full' | 'split-image' | 'centered' | 'standard'
export type BackgroundStyle = 'dark' | 'light' | 'cream'
export type FontCategory = 'serif' | 'sans' | 'display' | 'mixed'

/** Aus Referenz B abgeleiteter Style-Fingerprint (bestimmt Template/Layout). */
export interface StyleFingerprint {
  darkness: number
  warmth: number
  saturation: number
  elegance: number
  minimalism: number
  cinematic: number
  imagery: number
  family: string
  template: string
  reasons: string[]
}

/** Manuelle Stil-Regler auf der Vorschau-Seite. */
export interface StyleControls {
  archetypeOverride?: StyleArchetype
  /** 0..1 – wie stark die Referenz übernommen wird */
  referenceStrength: number
  darknessOverride?: 'darker' | 'lighter'
  imageryOverride?: 'more' | 'less'
  luxury?: boolean
  modern?: boolean
  moreBranding?: boolean
  lessGeneric?: boolean
  /** Referenzstil stärker erzwingen (dominantes Merkmal verstärken) */
  forceReferenceStyle?: boolean
  /** Neue Komposition erzeugen (Seed für Variation) */
  compositionSeed?: number
  // Brand-/Farb-Transfer
  brandMode?: BrandTransferMode
  /** 0..100 – wie stark das Branding von A wirkt */
  brandStrength?: number
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  /** vom Nutzer bestätigte/gesperrte Palette – überschreibt das Mapping */
  lockedPalette?: PreviewPalette
  paletteLocked?: boolean
  // Bild-Transfer
  useCustomerImages?: boolean
}

/** Aus Referenz B extrahiertes Stilprofil (nur allgemeine Wirkung, kein Layout-Klon). */
export interface StyleProfile {
  archetype: StyleArchetype
  layoutType: string
  heroType: HeroType
  backgroundStyle: BackgroundStyle
  overlay: boolean
  navPosition: 'over-hero' | 'top-bar' | 'centered'
  sectionOrder: PreviewSectionType[]
  visualMood: string
  emotionalMood: string
  spacingStyle: 'kompakt' | 'ausgewogen' | 'großzügig'
  cornerRadius: 'scharf' | 'soft' | 'rund'
  cardStyle: string
  navigationStyle: string
  ctaStyle: string
  colorMood: string
  typographyMood: 'serif-display' | 'modern-sans'
  fontCategory: FontCategory
  /** 0..1 (1 = sehr dunkel) */
  darkness: number
  imageHeavy: boolean
  hasSlider: boolean
  imageTreatment: string
  premiumSignals: string[]
  /** aus Referenz-Blueprint übernommene Struktur (nicht aus Template) */
  heroAlign?: 'left' | 'center' | 'right'
  logoCenter?: boolean
  navHasCta?: boolean
  footerColumns?: number
  /** Vorschau-Struktur stammt aus echter B-Analyse (nicht Template-Fallback) */
  blueprintDriven?: boolean
}

export type PreviewSectionType =
  | 'header'
  | 'hero'
  | 'trust'
  | 'services'
  | 'menu'
  | 'about'
  | 'benefits'
  | 'gallery'
  | 'reviews'
  | 'contact'
  | 'footer'

export interface PreviewSection {
  type: PreviewSectionType
  eyebrow?: string
  heading?: string
  subheading?: string
  body?: string
  items?: { title: string; text?: string }[]
  ctaLabel?: string
  /** Bild-Platzhalter-Beschriftung(en) für Restaurant-/Bildsektionen */
  imageLabels?: string[]
  /** echtes Bild von Kunde A (Hero/About-Hintergrund) */
  imageUrl?: string
  /** echte Bilder von Kunde A (Galerie) */
  imageUrls?: string[]
  note?: string
}

export interface PreviewPalette {
  // Markenrollen (Brand-Transfer)
  primary: string
  secondary: string
  cta: string
  ctaHover: string
  // Basis
  ink: string
  paper: string
  surface: string
  accent: string
  accentInk: string
  muted: string
  line: string
  overlay: string
}

export interface GeneratedHomepageConcept {
  companyName: string
  logoDataUrl?: string
  logoText: string
  archetype: StyleArchetype
  heroType: HeroType
  backgroundStyle: BackgroundStyle
  overlay: boolean
  fontCategory: FontCategory
  imageHeavy: boolean
  palette: PreviewPalette
  radius: StyleProfile['cornerRadius']
  spacing: StyleProfile['spacingStyle']
  typography: StyleProfile['typographyMood']
  navItems: string[]
  sections: PreviewSection[]
  /** Struktur aus Referenz B (bestimmt Rendering von Hero/Nav/Footer) */
  heroAlign?: 'left' | 'center' | 'right'
  logoCenter?: boolean
  navHasCta?: boolean
  footerColumns?: number
}

/** Normalisierter Struktur-Baustein einer Referenz-Sektion (aus echtem DOM klassifiziert). */
export type BlueprintBlock =
  | 'hero'
  | 'image' // großflächige Bild-/Banner-Fläche
  | 'split' // Text + Bild nebeneinander
  | 'cards' // Raster aus 3+ Karten/Kacheln
  | 'gallery' // Bildraster (viele Bilder)
  | 'text' // textdominante Fläche
  | 'stats' // kurze Kennzahlen-/Trust-Leiste
  | 'cta' // Handlungsaufforderung (Reservierung/Kontakt)
  | 'footer'

/** Live aus Referenz B extrahierte Layout-Blueprint (echte DOM-Analyse, kein Template). */
export interface ReferenceBlueprint {
  url: string
  ok: boolean
  heroType: HeroType
  heroOverlay: boolean
  heroTextAlign: 'left' | 'center' | 'right'
  heroTextColor: 'light' | 'dark'
  navPosition: 'over-hero' | 'top-bar'
  navSticky: boolean
  logoPosition: 'left' | 'center'
  reservationCta: boolean
  imageDominant: boolean
  backgroundStyle: BackgroundStyle
  darkness: number
  typography: 'serif-display' | 'modern-sans'
  cornerRadius: 'scharf' | 'soft' | 'rund'
  hasSlider: boolean
  scrollIndicator: boolean
  sectionCount: number
  sectionHeadings: string[]
  /** ECHTE, geordnete Struktur-Sequenz von B (bestimmt die Sektionsreihenfolge der Vorschau) */
  sectionSequence: BlueprintBlock[]
  /** separater CTA-Button in der Kopfzeile (z. B. „Reservieren“ oben rechts) */
  navHasCta: boolean
  /** Anzahl Footer-Spalten (Struktur des Footers) */
  footerColumns: number
  notes: string[]
}

export interface DesignPreviewInput {
  source: SourceCompany
  inspiration: InspirationReference
  analyzeSourceUrl?: boolean
  seed?: number
  controls?: StyleControls
  /** gecachte Blueprint (überspringt erneute B-Analyse bei Farb-/Regler-Änderungen) */
  referenceBlueprint?: ReferenceBlueprint
  /** Referenz B nicht neu analysieren (nur wenn Blueprint übergeben) */
  skipReferenceAnalysis?: boolean
  /** Layout-Signatur der vorherigen Vorschau (Referenzwechsel-Prüfung) */
  previousSignature?: string
  /** Referenz-URL der vorherigen Vorschau (Referenzwechsel-Prüfung) */
  previousReferenceUrl?: string
}

export interface StyleMatch {
  score: number
  breakdown: {
    colorMood: number
    archetype: number
    typography: number
    heroComposition: number
    cta: number
    navigation: number
    imageUsage: number
    industryMood: number
  }
  notes: string[]
}

export interface PresentationQuality {
  style: number
  brand: number
  presentable: number
  imageFit?: number
  layoutUniqueness?: number
  paletteAccuracy?: number
  ready: boolean
}

export interface DesignPreviewResult {
  concept: GeneratedHomepageConcept
  styleProfile: StyleProfile
  styleMatch: StyleMatch
  /** Referenz-Fingerprint + gewähltes Template + Layout-Signatur (für Varianz-Prüfung/Debug) */
  fingerprint?: StyleFingerprint
  chosenTemplate?: string
  layoutSignature?: string
  fallbackUsed?: boolean
  /** Vorschau blieb trotz Referenzwechsel gleich (Blueprint nicht angewendet) */
  layoutStale?: boolean
  /** aus B übernommene Sektions-Sequenz (für Debug-Panel) */
  generatedSectionOrder?: string[]
  /** live extrahierte Referenz-Blueprint + Struktur-Treue-Score */
  referenceBlueprint?: ReferenceBlueprint
  blueprintMatch?: { score: number; notes: string[] }
  /** Markenprofil + Transfer */
  brandProfile: BrandProfile
  brandTransferMode: BrandTransferMode
  brandStrength: number
  scores: PresentationQuality
  /** Bild-Transfer */
  imagePlacements: PreviewImagePlacement[]
  imageSummary: { found: number; used: number; placeholders: number; recommendations: string[]; fit?: ImageFitScore }
  brandSource: { logoColors: string[]; websiteColors: string[]; manualColors: string[]; finalPalette: PreviewPalette; winner: string }
  /** Herkunft jedes finalen CSS-Tokens (Debug/Validierung) */
  paletteSources?: Record<string, string>
  /** Begründung je Score (ehrliche Validierung) */
  scoreReasons?: string[]
  /** zuverlässig erkannte Kundenfarben (für das „Erkannte Kundenfarben“-Panel) */
  detectedColors?: DetectedColor[]
  /** Farb-Validierung der finalen Palette */
  colorValidation: { brandColorMatch: number; contrast: number; stylePreservation: number; warnings: string[] }
  designDecision: { fromReference: string[]; fromCustomer: string[]; colorAdaptation: string; presentation: string }
  inspiration: { name?: string; url?: string; designStyle?: string; colors: string[]; visualScore?: number; screenshot?: string }
  sourceScreenshot?: string
  controls: StyleControls
  /** weitere Konzeptvarianten (Referenznah / Ausgewogen / Markenfokus) */
  variants?: { label: string; concept: GeneratedHomepageConcept; scores: PresentationQuality }[]
  warnings: string[]
  legalNote: string
}

export interface SavedPreview {
  id: string
  title: string
  company: string
  inspirationSource: string
  createdAt: string
  projectId?: string
  result: DesignPreviewResult
  /** optionale KI-Vorschau (Prompt, Provider, Code, Validierung, Korrekturrunden) */
  aiPreview?: AIPreviewResult
}

/* ─────────────────────────  KI-VORSCHAU (AI Preview)  ───────────────────────── */

/** Auswählbarer KI-Provider für die Code-Generierung. Alle optional; „manual“ ist immer verfügbar. */
export type AIPreviewProvider = 'v0' | 'claude' | 'openai' | 'ollama' | 'manual'

/** Zielformat des generierten Codes bzw. des Export-Prompts. */
export type PreviewCodeFormat =
  | 'html'
  | 'react-tailwind'
  | 'nextjs'
  | 'lovable-prompt'
  | 'claude-code-prompt'
  | 'v0-prompt'

export type PreviewGenerationMode = 'ai' | 'manual'

/** Status/Konfiguration eines Providers (ohne den Key selbst preiszugeben). */
export interface ProviderConfig {
  provider: AIPreviewProvider
  label: string
  model?: string
  baseUrl?: string
  requiresKey: boolean
  hasKey: boolean
  available: boolean
  note?: string
}

export interface ProviderStatus {
  default: AIPreviewProvider
  providers: ProviderConfig[]
}

/** Automatisch erzeugter, präziser Prompt für die KI-Vorschau. */
export interface AIPreviewPrompt {
  system: string
  user: string
  blueprintSummary: string
  legalNote: string
  format: PreviewCodeFormat
  provider: AIPreviewProvider
}

export interface AIPreviewRequest {
  source: SourceCompany
  inspiration: InspirationReference
  result: DesignPreviewResult
  provider: AIPreviewProvider
  format: PreviewCodeFormat
  /** vom Nutzer bearbeiteter User-Prompt (überschreibt den automatischen) */
  customPrompt?: string
  /** max. automatische Korrekturrunden (Standard 2) */
  maxCorrections?: number
}

export interface GeneratedPreviewCode {
  format: PreviewCodeFormat
  code: string
  language: 'html' | 'jsx' | 'tsx' | 'text'
  /** sicher gesäubertes HTML für die iframe-Vorschau (nur bei reinem HTML) */
  renderableHtml?: string
}

export interface PreviewValidationCheck {
  id: string
  label: string
  pass: boolean
  detail?: string
}

/** Debug-Details der Validierung (verwendete/fehlende Farben & Bilder, Sicherheit). */
export interface PreviewValidationDetails {
  usedColors: string[]
  usedCustomerImages: string[]
  missingCustomerImages: string[]
  referenceColorsFound: string[]
  referenceImagesFound: string[]
  securityIssues: string[]
  imageCountInCode: number
}

export interface PreviewValidation {
  score: number
  passed: boolean
  checks: PreviewValidationCheck[]
  failures: string[]
  details?: PreviewValidationDetails
}

export interface AIPreviewResult {
  mode: PreviewGenerationMode
  provider: AIPreviewProvider
  providerUsed: AIPreviewProvider
  format: PreviewCodeFormat
  prompt: AIPreviewPrompt
  code?: GeneratedPreviewCode
  validation?: PreviewValidation
  corrections: number
  correctionPrompts: string[]
  /** fertiger Prompt-Text für manuelle Nutzung in externer KI */
  manualExport?: string
  error?: string
  createdAt: string
  notes: string[]
}
