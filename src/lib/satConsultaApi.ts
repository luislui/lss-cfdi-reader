/** Base URL del backend lssb-cfdi-satstatus. Vacío = mismo origen. Ej.: https://api.ejemplo.com o http://localhost:8080 */
const SAT_STATUS_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LSS_SAT_STATUS_API_URL) || ''

export type EstadoSat = 'No encontrado' | 'Vigente' | 'Cancelado' | 'Error'

export interface ConsultaParams {
  rfc_emisor: string
  rfc_receptor: string
  total: string
  uuid: string
}

interface ConsultaResponse {
  estado: EstadoSat
}

/**
 * Consulta el estado del CFDI en el SAT vía el backend lssb-cfdi-satstatus (POST /api/v1/sat/cfdi/status).
 * @returns "No encontrado" | "Vigente" | "Cancelado" | "Error"
 */
export async function consultaCfdiSat(params: ConsultaParams): Promise<EstadoSat> {
  const base = SAT_STATUS_API_BASE.replace(/\/$/, '')
  const url = base ? `${base}/api/v1/sat/cfdi/status` : '/api/v1/sat/cfdi/status'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        rfc_emisor: params.rfc_emisor,
        rfc_receptor: params.rfc_receptor,
        total: params.total,
        uuid: params.uuid,
      }),
    })
    if (!res.ok) return 'Error'
    const data = (await res.json()) as ConsultaResponse
    const estado = data?.estado
    if (estado === 'No encontrado' || estado === 'Vigente' || estado === 'Cancelado' || estado === 'Error') {
      return estado
    }
    return 'Error'
  } catch {
    return 'Error'
  }
}
