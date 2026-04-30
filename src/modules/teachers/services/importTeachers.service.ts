import { supabase } from '@/core/supabase'
import type { ParsedTeacher } from '../utils/excelTeachers.parser'

const CHUNK_SIZE = 500

// ── Types ──────────────────────────────────────────────────────────────────

export interface ImportProgress {
  processed: number
  total:     number
  percent:   number
}

export interface ImportResult {
  total:      number
  inserted:   number
  duplicates: number
  errors:     number
}

export type ImportStatus = 'success' | 'partial' | 'error'

export interface ImportLog {
  id:                string
  file_name:         string
  total_records:     number
  inserted_records:  number
  duplicate_records: number
  error_records:     number
  status:            ImportStatus
  source_type:       string
  created_by:        string | null
  created_at:        string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveStatus(result: ImportResult): ImportStatus {
  if (result.inserted === 0 && result.errors > 0) return 'error'
  if (result.errors > 0 || result.duplicates > 0) return 'partial'
  return 'success'
}

// ── Save log ───────────────────────────────────────────────────────────────

export async function saveTeacherImportLog(
  fileName: string,
  result:   ImportResult,
): Promise<void> {
  await supabase.from('import_logs').insert({
    file_name:         fileName,
    total_records:     result.total,
    inserted_records:  result.inserted,
    duplicate_records: result.duplicates,
    error_records:     result.errors,
    status:            resolveStatus(result),
    source_type:       'teachers',
  })
}

// ── Fetch history ──────────────────────────────────────────────────────────

export interface FetchLogsResult {
  data:  ImportLog[]
  count: number
}

export async function fetchTeacherImportLogs(
  page:     number = 1,
  pageSize: number = 10,
): Promise<FetchLogsResult> {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('import_logs')
    .select('*', { count: 'exact' })
    .eq('source_type', 'teachers')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  return {
    data:  (data ?? []) as ImportLog[],
    count: count ?? 0,
  }
}

// ── Import teachers ────────────────────────────────────────────────────────

/**
 * Upserts teachers in batches of CHUNK_SIZE.
 * Detects duplicates by checking existing DNIs before each batch.
 * On batch failure, retries row-by-row to isolate bad records.
 */
export async function importTeachers(
  teachers:   ParsedTeacher[],
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const total    = teachers.length
  let inserted   = 0
  let duplicates = 0
  let errors     = 0
  let processed  = 0

  const chunks: ParsedTeacher[][] = []
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    chunks.push(teachers.slice(i, i + CHUNK_SIZE))
  }

  for (const chunk of chunks) {
    const chunkDnis = chunk.map((t) => t.dni)

    const { data: existing, error: checkError } = await supabase
      .from('teachers')
      .select('dni')
      .in('dni', chunkDnis)

    if (checkError) {
      errors    += chunk.length
      processed += chunk.length
      onProgress({ processed, total, percent: Math.round((processed / total) * 100) })
      continue
    }

    const existingDnis = new Set((existing ?? []).map((r: { dni: string }) => r.dni))
    const newCount     = chunk.filter((t) => !existingDnis.has(t.dni)).length
    duplicates        += chunk.length - newCount

    const { error: upsertError } = await supabase
      .from('teachers')
      .upsert(chunk, { onConflict: 'dni' })

    if (upsertError) {
      for (const teacher of chunk) {
        const { error: rowError } = await supabase
          .from('teachers')
          .upsert([teacher], { onConflict: 'dni' })
        if (rowError) errors++
        else if (existingDnis.has(teacher.dni)) duplicates--
        else inserted++
      }
    } else {
      inserted += newCount
    }

    processed += chunk.length
    onProgress({ processed, total, percent: Math.round((processed / total) * 100) })
  }

  return { total, inserted, duplicates, errors }
}
