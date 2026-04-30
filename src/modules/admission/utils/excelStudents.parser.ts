import * as XLSX from 'xlsx'

// ── Column mapping ─────────────────────────────────────────────────────────
// Maps Excel header names → internal field keys
const COLUMN_MAP: Record<string, string> = {
  'id_persona':           'external_id',
  'Código estudiante':    'student_code',
  'Documento':            'dni',
  'Estudiante':           'full_name',
  'Sexo':                 'sex',
  'Correo Institucional': 'institutional_email',
  'Celular':              'phone',
  'Programa estudio':     'program',
  'Unidad académica':     'faculty',
  'Sede':                 'campus',
  'Modalidad estudio':    'modality',
  'Ciclo':                'cycle',
  'Grupo':                'group',
  'Pais':                 'country',
  'Fecha de nacimiento':  'birth_date',
  'Religión':             'religion',
}

const REQUIRED_COLUMNS = ['Documento', 'Estudiante']

// ── Types ──────────────────────────────────────────────────────────────────
export interface ParsedStudent {
  external_id:         string | null
  student_code:        string | null
  dni:                 string
  full_name:           string
  sex:                 string | null
  institutional_email: string | null
  phone:               string | null
  program:             string | null
  faculty:             string | null
  campus:              string | null
  modality:            string | null
  cycle:               string | null
  group:               string | null
  country:             string | null
  birth_date:          string | null
  religion:            string | null
}

export interface ParseResult {
  students:       ParsedStudent[]
  missingColumns: string[]
  skippedRows:    number
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normalize an Excel serial date or string date to ISO (YYYY-MM-DD) */
function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  // Excel serial number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (!date) return null
    const y = date.y
    const m = String(date.m).padStart(2, '0')
    const d = String(date.d).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // String date — try common formats
  const str = String(value).trim()
  if (!str) return null

  // DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy?.[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`
  }

  // YYYY-MM-DD already
  const iso = str.match(/^\d{4}-\d{2}-\d{2}$/)
  if (iso) return str

  // Attempt native parse as last resort
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)

  return null
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

// ── Main parser ────────────────────────────────────────────────────────────
export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: false })

        const sheetName = workbook.SheetNames[0]
        if (!sheetName) throw new Error('El archivo no contiene hojas de cálculo.')

        const sheet = workbook.Sheets[sheetName]
        if (!sheet) throw new Error('No se pudo acceder a la hoja de cálculo.')

        // raw: false → formatted strings; defval: '' → no undefined cells
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw: false,
          defval: '',
        })

        if (rows.length === 0) throw new Error('La hoja de cálculo está vacía.')

        // Validate required columns exist in first row
        const firstRow = rows[0] as Record<string, unknown>
        const presentHeaders = Object.keys(firstRow)
        const missingColumns = REQUIRED_COLUMNS.filter((col) => !presentHeaders.includes(col))

        if (missingColumns.length > 0) {
          resolve({ students: [], missingColumns, skippedRows: 0 })
          return
        }

        const students: ParsedStudent[] = []
        let skippedRows = 0

        for (const raw of rows) {
          const row = raw as Record<string, unknown>

          // Map Excel columns to internal keys
          const mapped: Record<string, unknown> = {}
          for (const [excelCol, fieldKey] of Object.entries(COLUMN_MAP)) {
            mapped[fieldKey] = row[excelCol] ?? null
          }

          // Skip row if DNI or full_name are empty
          const dni = toStr(mapped['dni'])
          const fullName = toStr(mapped['full_name'])
          if (!dni || !fullName) {
            skippedRows++
            continue
          }

          students.push({
            external_id:         toStr(mapped['external_id']),
            student_code:        toStr(mapped['student_code']),
            dni,
            full_name:           fullName,
            sex:                 toStr(mapped['sex']),
            institutional_email: toStr(mapped['institutional_email']),
            phone:               toStr(mapped['phone']),
            program:             toStr(mapped['program']),
            faculty:             toStr(mapped['faculty']),
            campus:              toStr(mapped['campus']),
            modality:            toStr(mapped['modality']),
            cycle:               toStr(mapped['cycle']),
            group:               toStr(mapped['group']),
            country:             toStr(mapped['country']),
            birth_date:          normalizeDate(mapped['birth_date']),
            religion:            toStr(mapped['religion']),
          })
        }

        resolve({ students, missingColumns: [], skippedRows })
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}
