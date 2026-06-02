import { supabase } from '@/core/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Campaign {
  id:         string
  name:       string
  start_date: string   // YYYY-MM-DD
  end_date:   string   // YYYY-MM-DD
  is_active:  boolean
  created_at: string
}

export interface PaginatedCampaigns {
  data:  Campaign[]
  count: number
}

const CAMPAIGN_SELECT = `id, name, start_date, end_date, is_active, created_at`

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getCampaigns(
  page:     number = 1,
  pageSize: number = 10,
): Promise<PaginatedCampaigns> {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('campaigns')
    .select(CAMPAIGN_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return {
    data:  (data ?? []) as Campaign[],
    count: count ?? 0,
  }
}

/** Returns the single active campaign, or null if none is set. */
export async function getActiveCampaign(): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select(CAMPAIGN_SELECT)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as Campaign | null
}

/**
 * Creates a new campaign and marks it as the active one.
 * Any previously active campaign is automatically deactivated.
 */
export async function createCampaign(payload: {
  name:       string
  start_date: string
  end_date:   string
}): Promise<Campaign> {
  // Deactivate current active campaign (if any)
  const { error: deactivateError } = await supabase
    .from('campaigns')
    .update({ is_active: false })
    .eq('is_active', true)
  if (deactivateError) throw deactivateError

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name:       payload.name.trim(),
      start_date: payload.start_date,
      end_date:   payload.end_date,
      is_active:  true,
    })
    .select(CAMPAIGN_SELECT)
    .single()

  if (error) throw error
  return data as Campaign
}

export async function updateCampaign(
  id:      string,
  payload: { name: string; start_date: string; end_date: string },
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      name:       payload.name.trim(),
      start_date: payload.start_date,
      end_date:   payload.end_date,
    })
    .eq('id', id)
    .select(CAMPAIGN_SELECT)
    .single()

  if (error) throw error
  return data as Campaign
}

/**
 * Designates a campaign as the active one.
 * Deactivates any previously active campaign first.
 */
export async function setActiveCampaign(id: string): Promise<void> {
  const { error: deactivateError } = await supabase
    .from('campaigns')
    .update({ is_active: false })
    .eq('is_active', true)
  if (deactivateError) throw deactivateError

  const { error } = await supabase
    .from('campaigns')
    .update({ is_active: true })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) throw error
}

// ── Validation helper (used by candidate registration) ─────────────────────

/**
 * Checks whether candidate forms can currently be created.
 * Returns { allowed: true } when there is an active campaign whose date range
 * includes today; otherwise returns { allowed: false, reason: '...' }.
 */
export async function isCampaignActiveAndValid(): Promise<{
  allowed: boolean
  reason?: string
  campaign?: Campaign
}> {
  const campaign = await getActiveCampaign()

  if (!campaign) {
    return { allowed: false, reason: 'No hay ninguna campaña activa configurada.' }
  }

  const today = new Date().toISOString().split('T')[0]

  if (today < campaign.start_date) {
    return {
      allowed: false,
      reason:  `La campaña "${campaign.name}" aún no ha comenzado.`,
      campaign,
    }
  }

  if (today > campaign.end_date) {
    return {
      allowed: false,
      reason:  `La campaña "${campaign.name}" ha finalizado. No es posible crear nuevas fichas.`,
      campaign,
    }
  }

  return { allowed: true, campaign }
}
