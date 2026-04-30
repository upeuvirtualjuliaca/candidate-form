import * as XLSX from 'xlsx'

// ── Column mapping ─────────────────────────────────────────────────────────
// Maps Excel header names → internal field keys
const COLUMN_MAP: Record<string, string> = {
  'Apellidos y nombres':                   'full_name',
  'Mayor grado académico':                 'academic_degree',
  'Tipo doc.':                             'doc_type',
  'N° DNI / CE':                           'dni',
  'Régimen de dedicación':                 'dedication_regime',
  'Condición lab. UPeU':                   'labor_condition',
  'Campus (Adscripción del docente)':      'campus',
  'Facultad / EPG (Adscripción del docente)': 'faculty',
  'EP (Adscripción de la asignatura)':     'ep',
  'Condición docente':                     'condition',
}

const REQUIRED_COLUMNS = ['N° DNI / CE', 'Apellidos y nombres']

// ── Types ──────────────────────────────────────────────────────────────────

/** One raw row extracted from the Excel (before aggregation). */
interface RawTeacherRow {
  dni:              string
  full_name:        string
  doc_type:         string | null
  academic_degree:  string | null
  dedication_regime: string | null
  labor_condition:  string | null
  campus:           string | null
  faculty:          string | null
  ep:               string | null
  condition:        string | null
}

/** One teacher record ready to upsert (one per unique DNI). */
export interface ParsedTeacher {
  dni:              string
  full_name:        string
  doc_type:         string | null
  academic_degree:  string | null
  dedication_regime: string | null
  labor_condition:  string | null
  campus:           string | null
  faculty:          string | null
  /** EP that appeared most frequently across all rows for this teacher. */
  main_ep:          string | null
  condition:        string | null
}

export interface ParseResult {
  teachers:       ParsedTeacher[]
  missingColumns: string[]
  skippedRows:    number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

/** Returns the value that appears most often in the array, or null if empty. */
function mostFrequent(values: string[]): string | null {
  if (values.length === 0) return null
  const freq: Record<string, number> = {}
  for (const v of values) freq[v] = (freq[v] ?? 0) + 1
  let best = values[0]!
  for (const [v, count] of Object.entries(freq)) {
    if (count > (freq[best] ?? 0)) best = v
  }
  return best
}

// ── Main parser ────────────────────────────────────────────────────────────

/**
 * Parses a teacher Excel file.
 * Each DNI may appear in multiple rows (one per subject assignment).
 * This function aggregates them into one record per teacher and
 * computes the most-frequent EP (Adscripción de la asignatura).
 */
export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: false })

        const sheetName = workbook.SheetNames[0]
        if (!sheetName) throw new Error('El archivo no contiene hojas de cálculo.')

        const sheet = workbook.Sheets[sheetName]
        if (!sheet) throw new Error('No se pudo acceder a la hoja de cálculo.')

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw: false,
          defval: '',
        })

        if (rows.length === 0) throw new Error('La hoja de cálculo está vacía.')

        // Validate required columns
        const firstRow      = rows[0] as Record<string, unknown>
        const presentHeaders = Object.keys(firstRow)
        const missingColumns = REQUIRED_COLUMNS.filter((col) => !presentHeaders.includes(col))

        if (missingColumns.length > 0) {
          resolve({ teachers: [], missingColumns, skippedRows: 0 })
          return
        }

        // ── Parse raw rows ─────────────────────────────────────────────────
        const rawRows: RawTeacherRow[] = []
        let skippedRows = 0

        for (const raw of rows) {
          const row = raw as Record<string, unknown>

          const mapped: Record<string, unknown> = {}
          for (const [excelCol, fieldKey] of Object.entries(COLUMN_MAP)) {
            mapped[fieldKey] = row[excelCol] ?? null
          }

          const dni      = toStr(mapped['dni'])
          const fullName = toStr(mapped['full_name'])
          if (!dni || !fullName) {
            skippedRows++
            continue
          }

          rawRows.push({
            dni,
            full_name:         fullName,
            doc_type:          toStr(mapped['doc_type']),
            academic_degree:   toStr(mapped['academic_degree']),
            dedication_regime: toStr(mapped['dedication_regime']),
            labor_condition:   toStr(mapped['labor_condition']),
            campus:            toStr(mapped['campus']),
            faculty:           toStr(mapped['faculty']),
            ep:                toStr(mapped['ep']),
            condition:         toStr(mapped['condition']),
          })
        }

        // ── Aggregate by DNI ───────────────────────────────────────────────
        // Keep insertion order (first occurrence = canonical personal data)
        const byDni = new Map<string, { first: RawTeacherRow; eps: string[] }>()

        for (const row of rawRows) {
          const entry = byDni.get(row.dni)
          if (!entry) {
            byDni.set(row.dni, { first: row, eps: row.ep ? [row.ep] : [] })
          } else {
            if (row.ep) entry.eps.push(row.ep)
          }
        }

        const teachers: ParsedTeacher[] = []
        for (const { first, eps } of byDni.values()) {
          teachers.push({
            dni:               first.dni,
            full_name:         first.full_name,
            doc_type:          first.doc_type,
            academic_degree:   first.academic_degree,
            dedication_regime: first.dedication_regime,
            labor_condition:   first.labor_condition,
            campus:            first.campus,
            faculty:           first.faculty,
            main_ep:           mostFrequent(eps),
            condition:         first.condition,
          })
        }

        resolve({ teachers, missingColumns: [], skippedRows })
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}
