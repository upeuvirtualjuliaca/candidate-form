import { jsPDF } from 'jspdf'
import {
  FAITH_QUESTIONS,
  HOW_KNEW_IASD_OPTIONS,
  HOW_STUDIED_BIBLE_OPTIONS,
  DECISIVE_FACTOR_OPTIONS,
} from '../constants/faithForm'
import type { CandidateDetail } from '../services/candidates.service'
import logoUrl from '../assets/pdf/Seventh-day_Adventist_Church_logo_in_Spanish.png'

// ── Logo preload (base64 + dimensiones naturales) ────────────────────────────
// Se precarga al importar el módulo para que esté lista cuando el usuario genere el PDF.
let _logoBase64: string | null = null
let _logoFormat: string = 'JPEG'
let _logoNaturalW = 1
let _logoNaturalH = 1

fetch(logoUrl)
  .then((r) => r.blob())
  .then(
    (blob) =>
      new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          // Obtener dimensiones reales cargando la imagen en un <img> temporal
          const img = new Image()
          img.onload = () => {
            _logoNaturalW = img.naturalWidth
            _logoNaturalH = img.naturalHeight
            // Comprimir a JPEG para reducir el tamaño del PDF (fondo blanco sobre transparencia)
            try {
              const canvas = document.createElement('canvas')
              canvas.width = img.naturalWidth
              canvas.height = img.naturalHeight
              const ctx2d = canvas.getContext('2d')!
              ctx2d.fillStyle = '#ffffff'
              ctx2d.fillRect(0, 0, canvas.width, canvas.height)
              ctx2d.drawImage(img, 0, 0)
              _logoBase64 = canvas.toDataURL('image/jpeg', 0.85)
              _logoFormat = 'JPEG'
            } catch {
              _logoBase64 = base64
              _logoFormat = 'PNG'
            }
            resolve()
          }
          img.onerror = () => {
            _logoBase64 = base64
            _logoFormat = 'PNG'
            resolve()
          }
          img.src = base64
        }
        reader.readAsDataURL(blob)
      }),
  )
  .catch(() => {
    /* logo opcional — si falla, el PDF se genera sin él */
  })

// ── Layout constants ──────────────────────────────────────────────────────────
const SX = 10 // left margin
const SY = 10 // top margin
const PW = 190 // usable page width  (210 - 2*SX)
const FOOT_H = 10 // footer reserve

// ── Value helpers ─────────────────────────────────────────────────────────────

function v(s: string | null | undefined): string {
  return s?.trim() || ''
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return ''
  try {
    const d = new Date(val + 'T12:00:00')
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return val
  }
}

function parseDateParts(val: string | null | undefined): {
  day: string
  month: string
  year: string
} {
  if (!val) return { day: '', month: '', year: '' }
  try {
    const d = new Date(val + 'T12:00:00')
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      year: String(d.getFullYear()),
    }
  } catch {
    return { day: '', month: '', year: '' }
  }
}

// ── Core drawing primitives ───────────────────────────────────────────────────

/**
 * Draw a bordered cell.
 * - label: small grey text at top-left (font 5.5pt bold)
 * - text:  value text below label (or centered if no label)
 */
function drawCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  text = '',
  opts: {
    label?: string
    fontSize?: number
    bold?: boolean
    align?: 'left' | 'center' | 'right'
    fill?: string
    textColor?: string
  } = {},
): void {
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.1)

  if (opts.fill) {
    doc.setFillColor(opts.fill)
    doc.rect(x, y, w, h, 'FD')
  } else {
    doc.rect(x, y, w, h, 'S')
  }

  if (opts.label) {
    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#555555')
    doc.text(opts.label, x + 1.5, y + 2.8)
  }

  if (text) {
    const fs = opts.fontSize ?? 7
    const pad = 1.5
    doc.setFontSize(fs)
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setTextColor(opts.textColor ?? '#000000')
    const textY = opts.label ? y + 6.5 : y + h / 2 + fs * 0.1
    const textX =
      opts.align === 'center' ? x + w / 2 : opts.align === 'right' ? x + w - pad : x + pad
    const lines = doc.splitTextToSize(text, w - pad * 2) as string[]
    doc.text(lines, textX, textY, { align: opts.align ?? 'left' })
  }
}

/**
 * Draw a checkbox (square + label). Returns the total horizontal space consumed.
 */
function drawCheckbox(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  checked: boolean,
  size = 2.5,
): number {
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.1)
  doc.rect(x, y, size, size, 'S')

  if (checked) {
    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#000000')
    // centrado perfecto: baseline = y + mitad del box + mitad de la cap-height (≈ size*0.35)
    doc.text('X', x + size / 2, y + size / 2 + size * 0.35, { align: 'center' })
  }

  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#000000')
  doc.text(label, x + size + 1, y + size / 2 + size * 0.35)

  return size + 1 + doc.getTextWidth(label) + 3
}

/**
 * Vertical text centered inside a colored strip.
 * angle: 90 → reads bottom-to-top.
 */
function drawVerticalText(
  doc: jsPDF,
  text: string,
  stripX: number,
  stripY: number,
  stripH: number,
  stripW: number,
): void {
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)

  const textW = doc.getTextWidth(text)

  // Con angle:90 (CCW), la baseline queda vertical.
  // Las letras mayúsculas se extienden hacia la IZQUIERDA de la baseline.
  // Para centrar horizontalmente el bloque visible en la franja,
  // desplazamos anchorX +capHeight/2 (≈ 35% del tamaño de fuente en mm).
  const fsMm = 9 * 0.3528 // 9pt → mm
  const capOffset = fsMm * 0.35 // mitad de cap-height aproximada

  const anchorX = stripX + stripW / 2 + capOffset // centrado horizontal real
  const anchorY = stripY + (stripH + textW) / 2 // centrado vertical

  doc.text(text, anchorX, anchorY, { angle: 90 })
  doc.setTextColor(0, 0, 0)
}

// ── Page chrome ───────────────────────────────────────────────────────────────

function drawAllFooters(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const total = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    const fy = pageH - 7
    doc.setDrawColor('#aaaaaa')
    doc.setLineWidth(0.2)
    doc.line(SX, fy, pageW - SX, fy)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#888888')
    doc.text(`Página ${i} de ${total}`, pageW - SX, fy + 4, { align: 'right' })
  }
}

function drawMiniHeader(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor('#04395a')
  doc.rect(0, 0, pageW, 8, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.text(
    'FICHA DE REGISTRO DE CANDIDATO  —  Universidad Peruana Unión  —  Dpto. Capellanía',
    pageW / 2,
    5.5,
    { align: 'center' },
  )
}

// ── Section header bar ────────────────────────────────────────────────────────

function drawSectionHeader(doc: jsPDF, y: number, num: string, title: string): number {
  const h = 7
  doc.setFillColor('#58595b')
  doc.rect(SX, y, PW, h, 'FD')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.text(`${num}.  ${title}`, SX + 3, y + 5)
  doc.setTextColor('#000000')
  return y + h
}

// ── HEADER (page 1) — 5 content rows + logo column on the left ───────────────

function drawMainHeader(doc: jsPDF, y: number, ceremonyType: string | null | undefined): number {
  const LOGO_W = 34 // logo column width (left side)
  const CONT_W = PW - LOGO_W // content column width
  const ROW1_H = 11 // title row
  const ROW2_H = 8 // subtitle row
  const ROW3_H = 5 // Bautismo row
  const ROW4_H = 5 // Rebautismo row
  const ROW5_H = 5 // Profesión de fe row
  const TOTAL_H = ROW1_H + ROW2_H + ROW3_H + ROW4_H + ROW5_H // 45 mm

  // ── Outer border ────────────────────────────────────────────────────────────
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.3)
  doc.rect(SX, y, PW, TOTAL_H, 'S')

  // ── Logo column (left side, spans all 5 rows) ────────────────────────────
  doc.setLineWidth(0.2)
  doc.line(SX + LOGO_W, y, SX + LOGO_W, y + TOTAL_H) // vertical divider

  if (_logoBase64) {
    const pad = 3 // margen interno (mm)
    const maxW = LOGO_W - pad * 2 // área disponible en X
    const maxH = TOTAL_H - pad * 2 // área disponible en Y
    // Escala uniforme: ajusta al lado más restrictivo manteniendo proporción
    const scale = Math.min(maxW / _logoNaturalW, maxH / _logoNaturalH)
    const imgW = _logoNaturalW * scale
    const imgH = _logoNaturalH * scale
    // Centra dentro del área disponible
    const imgX = SX + pad + (maxW - imgW) / 2
    const imgY = y + pad + (maxH - imgH) / 2
    doc.addImage(_logoBase64, _logoFormat, imgX, imgY, imgW, imgH)
  }

  // ── Content rows (right area) ────────────────────────────────────────────
  const cx = SX + LOGO_W

  // helper: draw a horizontal divider across content area
  const hline = (offsetY: number) => {
    doc.setDrawColor('#000000')
    doc.setLineWidth(0.2)
    doc.line(cx, y + offsetY, cx + CONT_W, y + offsetY)
  }

  // Row 1 — title
  doc.setFillColor('#58595b')
  doc.rect(cx, y, CONT_W, ROW1_H, 'F')

  const title = 'FICHA DE REGISTRO DE CANDIDATO'
  const x = cx + CONT_W / 2
  const yText = y + ROW1_H / 2 + 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor('#ffffff')

  // 🔥 “fake extra bold” SOLO en este texto
  doc.text(title, x, yText, { align: 'center' })
  doc.text(title, x + 0.1, yText, { align: 'center' })
  doc.text(title, x - 0.1, yText, { align: 'center' })

  // Row 2 — subtitle (MEJORADO)
  const subtitle = 'COMPLETE LA FICHA CON LETRA IMPRENTA Y NO DEJE ESPACIOS SIN RESPUESTA'

  // Fondo gris
  doc.setFillColor('#d1d3d4')
  doc.rect(cx, y + ROW1_H, CONT_W, ROW2_H, 'F')

  // Texto
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor('#000000')

  // centrado horizontal
  const textX = cx + CONT_W / 2

  // centrado vertical (ajustado visualmente en jsPDF)
  const textY = y + ROW1_H + ROW2_H / 2 + 1.2

  doc.text(subtitle, textX, textY, {
    align: 'center',
  })

  // Rows 3-5 — one checkbox per row
  const types = [
    { key: 'baptism', label: 'Bautismo', rowH: ROW3_H, offset: ROW1_H + ROW2_H },
    { key: 'rebaptism', label: 'Rebautismo', rowH: ROW4_H, offset: ROW1_H + ROW2_H + ROW3_H },
    {
      key: 'faith_profession',
      label: 'Profesión de fe',
      rowH: ROW5_H,
      offset: ROW1_H + ROW2_H + ROW3_H + ROW4_H,
    },
  ]

  for (let i = 0; i < types.length; i++) {
    const t = types[i]!
    // divider below rows 3 and 4 (not after the last row — outer border handles it)
    if (i < 2) hline(t.offset + t.rowH)
    const rowMidY = y + t.offset + t.rowH / 2
    drawCheckbox(doc, cx + 4, rowMidY - 1.5, t.label, ceremonyType === t.key, 3)
  }

  doc.setTextColor('#000000')
  return y + TOTAL_H
}

// ── SECTION 1: IDENTIFICACIÓN (grid layout) ───────────────────────────────────

function drawIdentificationSection(doc: jsPDF, startY: number, c: CandidateDetail): number {
  const s = c.students ?? c.teachers
  const STRIP_W = 8 // "IDENTIFICACIÓN" vertical strip
  const cx = SX + STRIP_W
  const cw = PW - STRIP_W // 182 mm content width
  const half = cw / 2 // 91 mm

  // Row heights
  const R = 8 // standard row
  const RC = 18 // checkbox row
  const R2 = RC / 2 // mitad de fila checkbox

  // La franja se dibuja AL FINAL, una vez conocida la altura real.
  let y = startY

  // ── Row 1: Nombres y Apellidos (columna combinada) ────────────────────────
  drawCell(doc, cx, y, cw, R, v(s?.full_name), {
    label: 'Nombres y Apellidos',
  })
  y += R

  // ── Row 2: Sexo | Fecha de nacimiento | País / Lugar de nacimiento ────────
  const sexW = 30
  const dateW = 55
  const lugarW = cw - sexW - dateW // 97 mm
  const row2Fill = '#f1f2f2'

  // Sexo cell
  drawCell(doc, cx, y, sexW, R, '', {
    label: 'Sexo',
    fill: row2Fill,
  })
  drawCheckbox(doc, cx + 2, y + 4, 'M', s?.sex === '1', 2.5)
  drawCheckbox(doc, cx + 12, y + 4, 'F', s?.sex === '2', 2.5)

  // Fecha de nacimiento (columna unificada)
  const birthDate = s?.birth_date
    ? new Date(s.birth_date + 'T12:00:00').toLocaleDateString('en-US') // formato: MM/DD/YYYY
    : ''

  drawCell(doc, cx + sexW, y, dateW, R, birthDate, {
    label: 'Fecha de nacimiento',
    fill: row2Fill,
  })

  drawCell(doc, cx + sexW + dateW, y, lugarW, R, v(s?.country), {
    label: 'Ciudad, provincia/región, país de nacimiento',
    fill: row2Fill,
  })
  y += R

  // ── Row 3: Madre | Padre (alineado con Sexo + Fecha) ─────────────────
  const motherW = sexW + dateW
  const fatherW = cw - motherW

  drawCell(doc, cx, y, motherW, R, v(c.guardian_2_name), {
    label: 'Nombre de la madre / responsable 2',
    fill: row2Fill,
  })

  drawCell(doc, cx + motherW, y, fatherW, R, v(c.guardian_1_name), {
    label: 'Nombre del padre / responsable 1',
    fill: row2Fill,
  })

  y += R

  // ── Row 4: Dirección ──────────────────────────────────────────────────────
  drawCell(doc, cx, y, cw, R, v(c.address), { label: 'Dirección residencial completa' })
  y += R

  // ── Row 5: Sede | Programa académico | Código postal ─────────────────────
  const sedeW = 55
  const progW = 87
  const cpW = cw - sedeW - progW // 40 mm
  drawCell(doc, cx, y, sedeW, R, '', { label: 'Barrio' })
  drawCell(doc, cx + sedeW, y, progW, R, '', {
    label: 'Ciudad, provincia/región, país de residencia',
  })
  drawCell(doc, cx + sedeW + progW, y, cpW, R, v(s?.postal_code), { label: 'Código postal' })
  y += R

  // ── Row 6: Teléfono | Correo institucional | Facultad ────────────────────
  const telW = 55
  const mailW = 87
  const facW = cw - telW - mailW // 40 mm
  drawCell(doc, cx, y, telW, R, v(s?.phone), { label: 'Teléfono / Celular', fill: row2Fill })
  drawCell(doc, cx + telW, y, mailW, R, v(s?.institutional_email), {
    label: 'Correo electrónico institucional',
    fill: row2Fill,
  })
  drawCell(doc, cx + telW + mailW, y, facW, R, v(s?.dni), {
    label: 'DNI',
    fill: row2Fill,
  })
  y += R

  // ── Row 7: Grado de instrucción + Profesión/Ocupación + Estado civil + Discapacidad ──

  const eduW = 48
  const profW = 64
  const civilW = 42
  const disabilityW = cw - eduW - profW - civilW // 28 mm

  // ──────────────────────────────────────────────────────────────────────────
  // 🔹 GRADO DE INSTRUCCIÓN (sin borde derecho)
  // ──────────────────────────────────────────────────────────────────────────

  // Bordes manuales (sin derecha)
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.1)

  // arriba
  doc.line(cx, y, cx + eduW, y)
  // izquierda
  doc.line(cx, y, cx, y + RC)
  // abajo
  doc.line(cx, y + RC, cx + eduW, y + RC)

  // label
  doc.setFontSize(5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#555555')
  doc.text('Grado de instrucción', cx + 1.5, y + 2.8)
  doc.setTextColor('#000000')

  // checkboxes
  const leftColX = cx + 2
  const rightColX = cx + eduW / 2
  const baseY = y + 5
  const gapY = 4

  drawCheckbox(doc, leftColX, baseY, 'Sin instrucción', c.education_level === 'none')
  drawCheckbox(doc, leftColX, baseY + gapY, 'Secundaria', c.education_level === 'secondary')
  drawCheckbox(doc, leftColX, baseY + gapY * 2, 'Otro', c.education_level === 'other')

  drawCheckbox(doc, rightColX, baseY, 'Primaria', c.education_level === 'primary')
  drawCheckbox(doc, rightColX, baseY + gapY, 'Superior', c.education_level === 'higher')

  // Si marcó Otro, imprimir el texto libre en la columna derecha a la misma altura
  if (c.education_level === 'other' && c.education_level_other) {
    const eduOtherLines = doc.splitTextToSize(c.education_level_other, eduW / 2 - 2) as string[]
    doc.setFontSize(5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#000000')
    doc.text(eduOtherLines[0] ?? '', rightColX, baseY + gapY * 2 + 2)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 🔹 PROFESIÓN / OCUPACIÓN (SIN BORDE IZQUIERDO COMPLETO)
  // ──────────────────────────────────────────────────────────────────────────

  doc.setLineWidth(0.1)
  // arriba
  doc.line(cx + eduW, y, cx + eduW + profW, y)

  // derecha
  doc.line(cx + eduW + profW, y, cx + eduW + profW, y + RC)

  // abajo
  doc.line(cx + eduW, y + RC, cx + eduW + profW, y + RC)

  // divisor horizontal (mitad)
  doc.line(cx + eduW, y + R2, cx + eduW + profW, y + R2)

  // 🔥 línea vertical corta (la clave visual)
  doc.line(cx + eduW, y, cx + eduW, y + R2)

  // labels + contenido
  drawCell(doc, cx + eduW, y, profW, R2, v(s?.program), {
    label: 'Profesión / Formación académica',
  })

  drawCell(doc, cx + eduW, y + R2, profW, R2, v(s?.modality), {
    label: 'Ocupación actual',
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 🔹 ESTADO CIVIL (dos columnas, igual que Grado de instrucción)
  // ──────────────────────────────────────────────────────────────────────────

  doc.setDrawColor('#000000')
  doc.setLineWidth(0.1)

  const civilBaseX = cx + eduW + profW
  // arriba
  doc.line(civilBaseX, y, civilBaseX + civilW, y)
  // izquierda
  doc.line(civilBaseX, y, civilBaseX, y + RC)
  // abajo
  doc.line(civilBaseX, y + RC, civilBaseX + civilW, y + RC)
  // derecha
  doc.line(civilBaseX + civilW, y, civilBaseX + civilW, y + RC)

  // label
  doc.setFontSize(5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#555555')
  doc.text('Estado civil', civilBaseX + 1.5, y + 2.8)
  doc.setTextColor('#000000')

  // checkboxes en dos columnas
  const civilLeftX = civilBaseX + 2
  const civilRightX = civilBaseX + civilW / 2
  const civilBaseY = y + 5
  const civilGapY = 4

  // columna izquierda: Soltero/a, Divorciado/a, Otro
  drawCheckbox(doc, civilLeftX, civilBaseY, 'Soltero/a', c.marital_status === 'single')
  drawCheckbox(
    doc,
    civilLeftX,
    civilBaseY + civilGapY,
    'Divorciado/a',
    c.marital_status === 'divorced',
  )
  drawCheckbox(doc, civilLeftX, civilBaseY + civilGapY * 2, 'Otro', c.marital_status === 'other')

  // columna derecha: Casado/a, Viudo/a
  drawCheckbox(doc, civilRightX, civilBaseY, 'Casado/a', c.marital_status === 'married')
  drawCheckbox(doc, civilRightX, civilBaseY + civilGapY, 'Viudo/a', c.marital_status === 'widowed')

  // Si marcó Casado/a, imprimir la fecha de matrimonio debajo
  if (c.marital_status === 'married' && c.wedding_date) {
    const wd = new Date(c.wedding_date + 'T12:00:00')
    const wdStr = `${String(wd.getDate()).padStart(2, '0')}/${String(wd.getMonth() + 1).padStart(2, '0')}/${wd.getFullYear()}`
    doc.setFontSize(5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#000000')
    doc.text(wdStr, civilRightX, civilBaseY + civilGapY * 2 + 2)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 🔹 DISCAPACIDAD (dos columnas, igual que Estado civil)
  // ──────────────────────────────────────────────────────────────────────────

  doc.setDrawColor('#000000')
  doc.setLineWidth(0.1)

  const disabilityBaseX = civilBaseX + civilW
  // arriba
  doc.line(disabilityBaseX, y, disabilityBaseX + disabilityW, y)
  // izquierda
  doc.line(disabilityBaseX, y, disabilityBaseX, y + RC)
  // abajo
  doc.line(disabilityBaseX, y + RC, disabilityBaseX + disabilityW, y + RC)
  // derecha
  doc.line(disabilityBaseX + disabilityW, y, disabilityBaseX + disabilityW, y + RC)

  // label (en dos líneas para que quepa)
  doc.setFontSize(5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#555555')
  doc.text('¿Tiene algún tipo de', disabilityBaseX + 1.5, y + 2.5)
  doc.text('discapacidad o condición?', disabilityBaseX + 1.5, y + 5)
  doc.setTextColor('#000000')

  // checkboxes en dos columnas: Sí / No
  const disabilityLeftX = disabilityBaseX + 2
  const disabilityRightX = disabilityBaseX + disabilityW / 2
  const disabilityBaseY = y + 8

  drawCheckbox(doc, disabilityLeftX, disabilityBaseY, 'Sí', c.has_disability === true)
  drawCheckbox(doc, disabilityRightX, disabilityBaseY, 'No', c.has_disability === false)

  // Si marcó Sí, imprimir los tipos de discapacidad seleccionados
  if (c.has_disability && c.disability_types && c.disability_types.length > 0) {
    const typesText = c.disability_types.join(', ')
    const lines = doc.splitTextToSize(typesText, disabilityW - 3) as string[]
    doc.setFontSize(5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#000000')
    lines.slice(0, 2).forEach((line, i) => {
      doc.text(line, disabilityBaseX + 1.5, y + 14 + i * 3.5)
    })
  }

  y += RC

  // ── Franja vertical "IDENTIFICACIÓN" — se dibuja al final con altura real ──
  const totalH = y - startY
  doc.setFillColor('#58595b')
  doc.rect(SX, startY, STRIP_W, totalH, 'FD')
  drawVerticalText(doc, 'IDENTIFICACIÓN', SX, startY, totalH, STRIP_W)

  return y
}

// ── SECTION 2: CONVERSIÓN ─────────────────────────────────────────────────────

interface FlowCtx {
  doc: jsPDF
  y: number
  pageH: number
}

function ensureSpace(ctx: FlowCtx, needed: number): void {
  if (ctx.y + needed > ctx.pageH - FOOT_H - 4) {
    ctx.doc.addPage()
    drawMiniHeader(ctx.doc)
    ctx.y = SY + 9
  }
}

function flowCell(ctx: FlowCtx, label: string, value: string, w: number, x: number): void {
  const lines = ctx.doc.splitTextToSize(v(value), w - 4) as string[]
  const h = Math.max(10, lines.length * 4.5 + 6)
  ensureSpace(ctx, h)
  drawCell(ctx.doc, x, ctx.y, w, h, v(value), { label })
  ctx.y += h
}

function flowRowPair(ctx: FlowCtx, l1: string, v1: string, l2: string, v2: string): void {
  const half = PW / 2
  const lines1 = ctx.doc.splitTextToSize(v(v1), half - 4) as string[]
  const lines2 = ctx.doc.splitTextToSize(v(v2), half - 4) as string[]
  const h = Math.max(10, Math.max(lines1.length, lines2.length) * 4.5 + 6)
  ensureSpace(ctx, h)
  drawCell(ctx.doc, SX, ctx.y, half, h, v(v1), { label: l1 })
  drawCell(ctx.doc, SX + half, ctx.y, half, h, v(v2), { label: l2 })
  ctx.y += h
}

function drawConversionSection(ctx: FlowCtx, c: CandidateDetail): void {
  ensureSpace(ctx, 20)

  const STRIP_W = 8 // franja vertical izquierda
  const cx = SX + STRIP_W // inicio del contenido
  const cw = PW - STRIP_W // ancho disponible
  const R = 8

  // col2 un poco más ancha que col1 y col3
  const col1W = 55
  const col3W = 54
  const col2W = cw - col1W - col3W // 73 mm

  // Guardar Y inicial para dibujar la franja al final
  const gridStartY = ctx.y

  // ── Row 1: Instructor 1 | Instructor 2 | Religión anterior ──────────────────
  ensureSpace(ctx, R)
  drawCell(ctx.doc, cx, ctx.y, col1W, R, v(c.biblical_instructor_1), {
    label: 'Instructor bíblico 1',
    fill: '#f1f2f2',
  })
  drawCell(ctx.doc, cx + col1W, ctx.y, col2W, R, v(c.biblical_instructor_2), {
    label: 'Instructor bíblico 2',
    fill: '#f1f2f2',
  })
  drawCell(ctx.doc, cx + col1W + col2W, ctx.y, col3W, R, v(c.previous_religion), {
    label: 'Religión anterior',
    fill: '#f1f2f2',
  })
  ctx.y += R

  // ── Row 2: Checkbox columns ─────────────────────────────────────────────────
  const checkH = 42
  const cbGapY = 4
  const cbLabelOff = 5.5

  ensureSpace(ctx, checkH)

  type CbOption = { value: string; label: string }

  const drawCheckboxColumn = (
    colX: number,
    colWidth: number,
    questionLabel: string,
    options: CbOption[],
    selected: string | null | undefined,
  ): void => {
    drawCell(ctx.doc, colX, ctx.y, colWidth, checkH, '', { label: questionLabel })

    const half = Math.ceil(options.length / 2)
    const innerLeft = colX + 2
    const innerRight = colX + colWidth / 2

    options.forEach(({ value, label }, i) => {
      const isLeft = i < half
      const row = isLeft ? i : i - half
      const px = isLeft ? innerLeft : innerRight
      const py = ctx.y + cbLabelOff + row * cbGapY
      drawCheckbox(ctx.doc, px, py, label, value === (selected ?? ''))
    })
  }

  const toOpts = (arr: string[]): CbOption[] => arr.map((v) => ({ value: v, label: v }))

  // Solo col3 necesita abreviación puntual ("Evangelismo Reencuentro" en 31mm de sub-col)
  const decisiveOpts: CbOption[] = DECISIVE_FACTOR_OPTIONS.map((v) => ({
    value: v,
    label: v === 'Evangelismo Reencuentro' ? 'Evang. Reencuentro' : v,
  }))

  drawCheckboxColumn(
    cx,
    col1W,
    '¿Cómo conociste la IASD?',
    toOpts(HOW_KNEW_IASD_OPTIONS),
    c.how_knew_iasd,
  )
  drawCheckboxColumn(
    cx + col1W,
    col2W,
    '¿Cómo estudiaste la Biblia?',
    toOpts(HOW_STUDIED_BIBLE_OPTIONS),
    c.how_studied_bible,
  )
  drawCheckboxColumn(
    cx + col1W + col2W,
    col3W,
    'Factor decisivo para bautismo',
    decisiveOpts,
    c.decisive_factor,
  )

  ctx.y += checkH

  // ── Franja vertical "CONVERSIÓN" — abarca Row 1 + Row 2 ─────────────────────
  const totalH = ctx.y - gridStartY
  ctx.doc.setFillColor('#58595b')
  ctx.doc.rect(SX, gridStartY, STRIP_W, totalH, 'FD')
  drawVerticalText(ctx.doc, 'CONVERSIÓN', SX, gridStartY, totalH, STRIP_W)

  // ── Campos adicionales ───────────────────────────────────────────────────────
  if (c.influential_person?.trim())
    flowCell(ctx, 'Persona influyente en mi conversión', c.influential_person, PW, SX)
  if (c.spiritual_experience?.trim())
    flowCell(ctx, 'Experiencia espiritual', c.spiritual_experience, PW, SX)
  if (c.conversion_observations?.trim())
    flowCell(ctx, 'Observaciones de conversión', c.conversion_observations, PW, SX)
}

// ── SECTION 3: DECLARACIÓN DE FE ─────────────────────────────────────────────

function drawFaithSection(ctx: FlowCtx, c: CandidateDetail): void {
  ensureSpace(ctx, 40)

  const STRIP_W = 8
  const cx = SX + STRIP_W
  const cw = PW - STRIP_W // 182
  const colW = cw / 2 // 91
  const ROWS = 7
  // Altura individual de cada fila (índice 0 = fila 1)
  const rowHeights: number[] = [6, 8, 9, 9, 6, 6, 12] // mm

  // Posición Y acumulada de cada fila
  const rowY = (row: number): number => rowHeights.slice(0, row).reduce((s, h) => s + h, 0)

  const answers: Record<string, boolean | null> =
    c.faith_answers && typeof c.faith_answers === 'object'
      ? (c.faith_answers as Record<string, boolean | null>)
      : {}

  // Checkbox metrics
  const cbSize = 2.5
  ctx.doc.setFontSize(6)
  const siW = cbSize + 1 + ctx.doc.getTextWidth('Sí') + 3
  const noW = cbSize + 1 + ctx.doc.getTextWidth('No')
  const cbAreaW = 2 + siW + noW // ≈ 20 mm

  // Question text metrics
  const fontSize = 5.5
  const lineH = fontSize * 0.3528 * 1.35
  const qTextW = colW - cbAreaW - 2

  const gridStartY = ctx.y
  const totalH = rowHeights.reduce((s, h) => s + h, 0)

  ctx.doc.setDrawColor('#000000')
  ctx.doc.setLineWidth(0.1)
  ctx.doc.setFillColor('#ffffff')

  // ── Col 2: 7 filas — filas Q7,Q9,Q11,Q13 (índices 0,2,4,6) con fondo gris ──
  for (let row = 0; row < ROWS; row++) {
    ctx.doc.setFillColor(row % 2 === 0 ? '#f1f2f2' : '#ffffff')
    ctx.doc.rect(cx + colW, gridStartY + rowY(row), colW, rowHeights[row]!, 'FD')
  }

  // ── Col 1: filas 1,3,5,6 con fondo gris; filas 2,4,7 en blanco ──
  const col1Fills = ['#f1f2f2', '#ffffff', '#f1f2f2', '#ffffff']
  for (let row = 0; row < 4; row++) {
    ctx.doc.setFillColor(col1Fills[row]!)
    ctx.doc.rect(cx, gridStartY + rowY(row), colW, rowHeights[row]!, 'FD')
  }
  // Celda combinada filas 5-6: gris
  ctx.doc.setFillColor('#f1f2f2')
  ctx.doc.rect(cx, gridStartY + rowY(4), colW, rowHeights[4]! + rowHeights[5]!, 'FD')
  // Fila 7: blanco
  ctx.doc.setFillColor('#ffffff')
  ctx.doc.rect(cx, gridStartY + rowY(6), colW, rowHeights[6]!, 'FD')

  // Helper: checkboxes + texto centrados verticalmente en una celda
  const drawRow = (qIdx: number, colX: number, ry: number, cellH: number) => {
    const ans = answers[String(qIdx)]
    const qText = `${qIdx + 1}. ${FAITH_QUESTIONS[qIdx] ?? ''}`

    const cbX = colX + 2
    const cbY = ry + (cellH - cbSize) / 2
    drawCheckbox(ctx.doc, cbX, cbY, 'Sí', ans === true, cbSize)
    drawCheckbox(ctx.doc, cbX + siW, cbY, 'No', ans === false, cbSize)

    ctx.doc.setFontSize(fontSize)
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setTextColor('#000000')
    const lines = ctx.doc.splitTextToSize(qText, qTextW) as string[]
    const totalTextH = lines.length * lineH
    const capH  = fontSize * 0.3528 * 0.72   // baseline offset: cap height ≈ 72% of em
    const textY = ry + (cellH - totalTextH) / 2 + capH
    lines.forEach((line, li) => ctx.doc.text(line, colX + cbAreaW, textY + li * lineH))
  }

  // ── Columna 1 ──────────────────────────────────────────────────────────────
  for (let row = 0; row < 4; row++) drawRow(row, cx, gridStartY + rowY(row), rowHeights[row]!)
  // Q5 en celda combinada filas 5-6
  drawRow(4, cx, gridStartY + rowY(4), rowHeights[4]! + rowHeights[5]!)
  // Q6 en fila 7
  drawRow(5, cx, gridStartY + rowY(6), rowHeights[6]!)

  // ── Columna 2: Q7–Q13 (índices 6–12) ──────────────────────────────────────
  for (let row = 0; row < ROWS; row++)
    drawRow(row + 6, cx + colW, gridStartY + rowY(row), rowHeights[row]!)

  ctx.y = gridStartY + totalH

  // ── Vertical strip dibujado al final (altura conocida) ─────────────────────
  ctx.doc.setFillColor('#58595b')
  ctx.doc.rect(SX, gridStartY, STRIP_W, totalH, 'FD')
  drawVerticalText(ctx.doc, 'DECLARACIÓN DE FE', SX, gridStartY, totalH, STRIP_W)

  // ── Dos filas de texto debajo del bloque ──────────────────────────────────
  const rowTexts = [
    'CREO Y ACEPTO LAS CREENCIAS FUNDAMENTALES, NORMAS Y PRINCIPIOS DE LA IGLESIA ADVENTISTA DEL SÉPTIMO DÍA, INCLUIDA LA DISCIPLINA ECLESIÁSTICA, EXPRESADA EN EL "MANUAL DE LA IGLESIA", Y DESEO SER MIEMBRO DE ESTA CONGREGACIÓN LOCAL DE LA IGLESIA ADVENTISTA MUNDIAL.',
    'CON MI FIRMA DOY MI EXPRESO CONSENTIMIENTO PARA QUE LA IGLESIA ADVENTISTA DEL SÉPTIMO DÍA UTILICE MIS DATOS PERSONALES DE ACUERDO CON LA LEY, ESPECÍFICAMENTE EN EL CUMPLIMIENTO DE SUS FINALIDADES INSTITUCIONALES. LA POLÍTICA DE PRIVACIDAD ESTÁ PUBLICADA EN EL SITIO WEB: http://adv.st/privacidad',
  ]
  const ROW_H    = 7
  const extraLineH = 5 * 0.3528 * 1.35
  const extraCapH  = 5 * 0.3528 * 0.72
  const URL_TOKEN  = 'http://adv.st/privacidad'

  for (let i = 0; i < 2; i++) {
    const ry = ctx.y + i * ROW_H
    ctx.doc.setDrawColor(0, 0, 0)
    ctx.doc.setLineWidth(0.1)
    ctx.doc.setFillColor(i === 0 ? '#d1d3d4' : '#f1f2f2')
    ctx.doc.rect(SX, ry, PW, ROW_H, 'FD')
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setFontSize(5)
    ctx.doc.setTextColor(0, 0, 0)

    const fullText = rowTexts[i]!
    const urlIdx   = fullText.indexOf(URL_TOKEN)

    if (i === 1 && urlIdx !== -1) {
      // Texto antes del link
      const before = fullText.slice(0, urlIdx)
      const lines  = ctx.doc.splitTextToSize(before, PW - 3) as string[]
      const totalTextH = lines.length * extraLineH
      const textY  = ry + (ROW_H - totalTextH) / 2 + extraCapH
      // Todas las líneas en negro
      lines.forEach((line, li) => ctx.doc.text(line, SX + 1.5, textY + li * extraLineH))
      // Link en azul, en la misma línea que la última (después del texto)
      const lastLineW = ctx.doc.getTextWidth(lines[lines.length - 1] ?? '')
      const spaceW    = ctx.doc.getTextWidth(' ')
      ctx.doc.setTextColor(0, 0, 255)
      ctx.doc.text(URL_TOKEN, SX + 1.5 + lastLineW + spaceW, textY + (lines.length - 1) * extraLineH)
      ctx.doc.setTextColor(0, 0, 0)
    } else {
      const lines = ctx.doc.splitTextToSize(fullText, PW - 3) as string[]
      const totalTextH = lines.length * extraLineH
      const textY = ry + (ROW_H - totalTextH) / 2 + extraCapH
      lines.forEach((line, li) => ctx.doc.text(line, SX + 1.5, textY + li * extraLineH))
    }
  }

  ctx.y += ROW_H * 2

  // ── 3 filas × 4 columnas debajo ────────────────────────────────────────────
  const COL4_W    = PW / 4  // 47.5 mm cada columna
  const col4Heights = [4, 7, 7]  // altura por fila
  const col4Labels: (string | null)[][] = [
    ['Nombre del responsable', 'Documento de identificación', 'Firma del responsable', null],
    [null, null, null, null],
    [null, null, null, null],
  ]

  const col4MergedH = col4Heights.reduce((s, h) => s + h, 0)  // 4+7+7 = 18mm
  const col4StartY  = ctx.y

  ctx.doc.setDrawColor(0, 0, 0)
  ctx.doc.setLineWidth(0.1)
  let col4Y = ctx.y
  for (let row = 0; row < 3; row++) {
    const rowH = col4Heights[row]!
    for (let col = 0; col < 3; col++) {  // solo cols 1-3
      ctx.doc.setFillColor(255, 255, 255)
      ctx.doc.rect(SX + col * COL4_W, col4Y, COL4_W, rowH, 'FD')
      const label = col4Labels[row]?.[col]
      if (label) {
        ctx.doc.setFontSize(5)
        ctx.doc.setFont('helvetica', 'bold')
        ctx.doc.setTextColor(85, 85, 85)
        ctx.doc.text(label, SX + col * COL4_W + 1.5, col4Y + 2.8)
        ctx.doc.setTextColor(0, 0, 0)
      }
    }
    col4Y += rowH
  }

  // ── Datos del responsable (solo si existe guardian_1_name) ─────────────────
  const dataY   = col4StartY + col4Heights[0]!
  const dataH   = col4Heights[1]! + col4Heights[2]!

  if (v(c.guardian_1_name)) {
    // Col 0 — Nombre del responsable
    const nameLines = ctx.doc.splitTextToSize(v(c.guardian_1_name), COL4_W - 3) as string[]
    ctx.doc.setFontSize(7)
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setTextColor(0, 0, 0)
    ctx.doc.text(nameLines, SX + 1.5, dataY + 5)

    // Col 1 — Documento de identificación
    const docLines = ctx.doc.splitTextToSize(v(c.guardian_1_document), COL4_W - 3) as string[]
    ctx.doc.setFontSize(7)
    ctx.doc.text(docLines, SX + COL4_W + 1.5, dataY + 5)

    // Col 2 — Firma del responsable 1 (solo en la primera fila de datos, 7mm)
    const gSigX1    = SX + COL4_W * 2 + 2
    const gSigX2    = SX + COL4_W * 3 - 2
    const row1H     = col4Heights[1]!          // 7mm — primera fila de datos
    const gSigLineY = dataY + row1H - 1.5      // línea al fondo de esa fila
    if (c.guardian_signature_data) {
      const imgW = gSigX2 - gSigX1
      const imgH = row1H - 2                   // imagen ocupa la fila sin salir
      ctx.doc.addImage(c.guardian_signature_data, 'PNG', gSigX1, dataY + 0.5, imgW, imgH)
    }
    ctx.doc.setLineWidth(0.1)
  }

  // Col 4: celda combinada (3 filas → 18mm)
  ctx.doc.setFillColor(255, 255, 255)
  ctx.doc.rect(SX + 3 * COL4_W, col4StartY, COL4_W, col4MergedH, 'FD')

  // Línea de firma centrada verticalmente
  const sigPad  = 4
  const sigLineY = col4StartY + col4MergedH - sigPad
  const sigX1   = SX + 3 * COL4_W + 3
  const sigX2   = SX + 4 * COL4_W - 3
  if (c.signature_data) {
    const imgW = sigX2 - sigX1
    const imgH = sigLineY - col4StartY - 2
    ctx.doc.addImage(c.signature_data, 'PNG', sigX1, col4StartY + 1, imgW, imgH)
  }
  ctx.doc.setDrawColor(0, 0, 0)
  ctx.doc.setLineWidth(0.3)
  ctx.doc.line(sigX1, sigLineY, sigX2, sigLineY)
  ctx.doc.setFontSize(5)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setTextColor(85, 85, 85)
  ctx.doc.text('Firma del candidato/a', (sigX1 + sigX2) / 2, sigLineY + 2.5, { align: 'center' })
  ctx.doc.setTextColor(0, 0, 0)

  ctx.y = col4StartY + col4MergedH
}

// ── SECTION 4: CEREMONIA ──────────────────────────────────────────────────────

function drawCeremonySection(ctx: FlowCtx, c: CandidateDetail, churchSecretary?: string, churchSecretarySignature?: string | null, officiantPastorSignature?: string | null): void {
  const STRIP_W   = 8
  const cx        = SX + STRIP_W
  const cw        = PW - STRIP_W  // 182mm
  const rowHeights = [8, 8, 8, 8] // 4 filas
  const gridStartY = ctx.y
  const totalH     = rowHeights.reduce((s, h) => s + h, 0)

  ctx.doc.setDrawColor(0, 0, 0)
  ctx.doc.setLineWidth(0.1)

  const colW = cw / 3  // 3 columnas iguales ≈ 60.67mm cada una

  let ry = gridStartY
  for (let row = 0; row < rowHeights.length; row++) {
    const h = rowHeights[row]!

    if (row === 1) {
      // Fila 2: col 1+2 combinadas → fondo gris (Nombre pastor)
      ctx.doc.setFillColor('#f1f2f2')
      ctx.doc.rect(cx, ry, colW * 2, h, 'FD')
    } else if (row === 0) {
      // Fila 1: col 1+2 individuales → fondo gris (Fecha y Lugar ceremonia)
      for (let col = 0; col < 2; col++) {
        ctx.doc.setFillColor('#f1f2f2')
        ctx.doc.rect(cx + col * colW, ry, colW, h, 'FD')
      }
    } else if (row === 3) {
      // Fila 4: col 1+2 individuales, col 3 omitida (va en celda combinada fila 4)
      for (let col = 0; col < 2; col++) {
        ctx.doc.setFillColor(255, 255, 255)
        ctx.doc.rect(cx + col * colW, ry, colW, h, 'FD')
      }
    } else {
      for (let col = 0; col < 3; col++) {
        ctx.doc.setFillColor(255, 255, 255)
        ctx.doc.rect(cx + col * colW, ry, colW, h, 'FD')
      }
    }

    // Fila 3
    if (row === 2) {
      // Col 1: Nombre de la iglesia/grupo receptora
      ctx.doc.setFontSize(5)
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setTextColor(85, 85, 85)
      ctx.doc.text('Nombre de la iglesia/grupo que lo/la recibió como miembro', cx + 1.5, ry + 2.8)
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7)
      ctx.doc.setTextColor(0, 0, 0)
      const churchLines = ctx.doc.splitTextToSize(v(c.receiving_church), colW - 3) as string[]
      ctx.doc.text(churchLines, cx + 1.5, ry + h / 2 + 1.5)

      // Col 2: Ciudad y provincia/región de la iglesia/grupo organizado
      ctx.doc.setFontSize(5)
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setTextColor(85, 85, 85)
      ctx.doc.text('Ciudad y provincia/región de la iglesia/grupo organizado', cx + colW + 1.5, ry + 2.8)
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7)
      ctx.doc.setTextColor(0, 0, 0)
      const cityLines = ctx.doc.splitTextToSize(v(c.church_city), colW - 3) as string[]
      ctx.doc.text(cityLines, cx + colW + 1.5, ry + h / 2 + 1.5)
    }

    // Fila 2: col 1+2 combinadas → Nombre del pastor oficiante
    if (row === 1) {
      ctx.doc.setFontSize(5)
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setTextColor(85, 85, 85)
      ctx.doc.text('Nombre completo del pastor oficiante', cx + 1.5, ry + 2.8)
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7)
      ctx.doc.setTextColor(0, 0, 0)
      const pastorLines = ctx.doc.splitTextToSize(v(c.officiating_pastor), colW * 2 - 3) as string[]
      ctx.doc.text(pastorLines, cx + 1.5, ry + h / 2 + 1.5)
    }

    // Fila 4
    if (row === 3) {
      // Col 1: Fecha y voto de la Reunión Regular/Administrativa
      ctx.doc.setFontSize(5)
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setTextColor(85, 85, 85)
      ctx.doc.text('Fecha y voto de la Reunión Regular/Administrativa', cx + 1.5, ry + 2.8)
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7)
      ctx.doc.setTextColor(0, 0, 0)
      const adminDateBase = c.administrative_meeting_date
        ? new Date(c.administrative_meeting_date + 'T12:00:00').toLocaleDateString('en-US')
        : ''
      const adminDateStr = adminDateBase
        ? `${adminDateBase} |Voto: ${c.ceremony_voto ?? ''}`
        : ''
      ctx.doc.text(adminDateStr, cx + 1.5, ry + h / 2 + 1.5)

      // Col 2: Nombre del secretario/a de la iglesia/grupo organizado
      ctx.doc.setFontSize(5)
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setTextColor(85, 85, 85)
      ctx.doc.text('Nombre del secretario/a de la iglesia/grupo organizado', cx + colW + 1.5, ry + 2.8)
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7)
      ctx.doc.setTextColor(0, 0, 0)
      const secLines = ctx.doc.splitTextToSize(v(churchSecretary), colW - 3) as string[]
      ctx.doc.text(secLines, cx + colW + 1.5, ry + h / 2 + 1.5)
    }

    // Fila 1
    if (row === 0) {
      // Col 1: Fecha de la ceremonia
      const ceremonyDateStr = c.ceremony_date
        ? new Date(c.ceremony_date + 'T12:00:00').toLocaleDateString('en-US')
        : ''
      ctx.doc.setFontSize(5)
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setTextColor(85, 85, 85)
      ctx.doc.text('Fecha de la ceremonia', cx + 1.5, ry + 2.8)
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7)
      ctx.doc.setTextColor(0, 0, 0)
      ctx.doc.text(ceremonyDateStr, cx + 1.5, ry + h / 2 + 1.5)

      // Col 2: Lugar, ciudad y provincia/región de la ceremonia
      const placeStr = [v(c.ceremony_place), v(c.church_city)].filter(Boolean).join(', ')
      ctx.doc.setFontSize(5)
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setTextColor(85, 85, 85)
      ctx.doc.text('Lugar, ciudad y provincia/región de la ceremonia', cx + colW + 1.5, ry + 2.8)
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7)
      ctx.doc.setTextColor(0, 0, 0)
      const placeLines = ctx.doc.splitTextToSize(placeStr, colW - 3) as string[]
      ctx.doc.text(placeLines, cx + colW + 1.5, ry + h / 2 + 1.5)
    }

    ry += h
  }

  // Col 3, filas 3+4 combinadas: firma del secretario/a
  const col3X     = cx + colW * 2
  const merged2H  = rowHeights[2]! + rowHeights[3]!  // 16mm
  const merged2Y  = gridStartY + rowHeights[0]! + rowHeights[1]!
  ctx.doc.setFillColor(255, 255, 255)
  ctx.doc.rect(col3X, merged2Y, colW, merged2H, 'FD')
  const sigLine2Y = merged2Y + merged2H - 4
  // Imagen de firma del secretario/a (si existe)
  if (churchSecretarySignature) {
    const imgW = colW - 6
    const imgH = sigLine2Y - merged2Y - 1
    ctx.doc.addImage(churchSecretarySignature, 'PNG', col3X + 3, merged2Y + 0.5, imgW, imgH)
  }
  ctx.doc.setDrawColor(0, 0, 0)
  ctx.doc.setLineWidth(0.3)
  ctx.doc.line(col3X + 3, sigLine2Y, col3X + colW - 3, sigLine2Y)
  ctx.doc.setFontSize(5)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setTextColor(85, 85, 85)
  ctx.doc.text('Firma del secretario/a de la iglesia/grupo organizado', col3X + colW / 2, sigLine2Y + 2.5, { align: 'center' })
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.setLineWidth(0.1)

  // Col 3, filas 1+2 combinadas: firma del pastor oficiante
  const mergedH = rowHeights[0]! + rowHeights[1]!  // 16mm
  ctx.doc.setFillColor('#f1f2f2')
  ctx.doc.rect(col3X, gridStartY, colW, mergedH, 'FD')
  const sigLineY = gridStartY + mergedH - 4
  // Imagen de firma del pastor oficante (si existe)
  if (officiantPastorSignature) {
    const imgW = colW - 6
    const imgH = sigLineY - gridStartY - 1
    ctx.doc.addImage(officiantPastorSignature, 'PNG', col3X + 3, gridStartY + 0.5, imgW, imgH)
  }
  ctx.doc.setDrawColor(0, 0, 0)
  ctx.doc.setLineWidth(0.3)
  ctx.doc.line(col3X + 3, sigLineY, col3X + colW - 3, sigLineY)
  ctx.doc.setFontSize(5)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setTextColor(85, 85, 85)
  ctx.doc.text('Firma del pastor oficiante', col3X + colW / 2, sigLineY + 2.5, { align: 'center' })
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.setLineWidth(0.1)

  ctx.y = gridStartY + totalH

  // Franja vertical
  ctx.doc.setFillColor('#58595b')
  ctx.doc.rect(SX, gridStartY, STRIP_W, totalH, 'FD')
  drawVerticalText(ctx.doc, 'CEREMONIA', SX, gridStartY, totalH, STRIP_W)
}

// ── SIGNATURES ────────────────────────────────────────────────────────────────

function drawSignatures(ctx: FlowCtx): void {
  ensureSpace(ctx, 40)
  ctx.y += 6

  const sigW = (PW - 8) / 3
  const labels = ['Firma del candidato/a', 'Firma del pastor / capellán', 'Firma del secretario/a']

  for (let i = 0; i < 3; i++) {
    const sx = SX + i * (sigW + 4)
    const lineY = ctx.y + 20
    ctx.doc.setDrawColor('#333333')
    ctx.doc.setLineWidth(0.4)
    ctx.doc.line(sx, lineY, sx + sigW, lineY)
    ctx.doc.setFontSize(6.5)
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setTextColor('#666666')
    ctx.doc.text(labels[i] ?? '', sx + sigW / 2, lineY + 5, { align: 'center' })
  }

  ctx.y += 30
}

// ── BUILD (shared) ────────────────────────────────────────────────────────────

function buildDoc(candidate: CandidateDetail, opts?: { churchSecretary?: string; churchSecretarySignature?: string | null; officiantPastorSignature?: string | null }): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const pageH = doc.internal.pageSize.getHeight()

  // PAGE 1: Header + Section 1 + Section 2
  let y = SY
  y = drawMainHeader(doc, y, candidate.ceremony_type)
  y = drawIdentificationSection(doc, y, candidate)

  const ctx: FlowCtx = { doc, y, pageH }
  drawConversionSection(ctx, candidate)
  drawFaithSection(ctx, candidate)
  drawCeremonySection(ctx, candidate, opts?.churchSecretary, opts?.churchSecretarySignature, opts?.officiantPastorSignature)
  return doc
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/** Download the PDF directly to the browser. */
export function generateCandidatePdf(
  candidate: CandidateDetail,
  opts?: { churchSecretary?: string; churchSecretarySignature?: string | null; officiantPastorSignature?: string | null },
): void {
  const doc = buildDoc(candidate, opts)
  const name = (candidate.students?.full_name ?? candidate.teachers?.full_name)?.replace(/\s+/g, '_') ?? 'candidato'
  doc.save(`ficha_${name}_${candidate.id.slice(0, 8)}.pdf`)
}

/**
 * Build the PDF and return a blob URL for in-browser preview.
 * Call URL.revokeObjectURL(url) when the preview is closed.
 */
export function previewCandidatePdf(
  candidate: CandidateDetail,
  opts?: { churchSecretary?: string; churchSecretarySignature?: string | null; officiantPastorSignature?: string | null },
): string {
  const doc = buildDoc(candidate, opts)
  return doc.output('bloburl') as unknown as string
}
