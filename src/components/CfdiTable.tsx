import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { CfdiRow } from '../lib/cfdiParser'
import { consultaCfdiSat } from '../lib/satConsultaApi'
import { exportTableToExcel } from '../utils/exportExcel'

const DEFAULT_COL_WIDTH = 150
const MIN_COL_WIDTH = 80
const ROW_NUM_COL_WIDTH = 44
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const
const DEFAULT_PAGE_SIZE = 50

export type TableColumn = { id: string; label: string }

const BASE_COLUMNS: TableColumn[] = [
  { id: 'Estado', label: 'Estado' },
  { id: 'Version', label: 'Versión' },
  { id: 'Fecha', label: 'Fecha' },
  { id: 'Serie', label: 'Serie' },
  { id: 'Folio', label: 'Folio' },
  { id: 'UUID', label: 'UUID' },
  { id: 'TipoDeComprobante', label: 'Tipo' },
  { id: 'EmisorRfc', label: 'Emisor RFC' },
  { id: 'EmisorNombre', label: 'Emisor' },
  { id: 'EmisorRegimenFiscal', label: 'Emisor régimen fiscal' },
  { id: 'ReceptorRfc', label: 'Receptor RFC' },
  { id: 'ReceptorNombre', label: 'Receptor' },
  { id: 'RegimenFiscalReceptor', label: 'Receptor régimen fiscal' },
  { id: 'UsoCFDI', label: 'Uso CFDI' },
  { id: 'SubTotal', label: 'SubTotal' },
  { id: 'Descuento', label: 'Descuento' },
  { id: 'Total', label: 'Total' },
  { id: 'Moneda', label: 'Moneda' },
  { id: 'TipoCambio', label: 'Tipo cambio' },
  { id: 'MetodoPago', label: 'Metodo pago' },
  { id: 'FormaPago', label: 'Forma pago' },
  { id: 'LugarExpedicion', label: 'Lugar expedición' },
  { id: 'FechaTimbrado', label: 'Fecha timbrado' },
]

const TRASLADO_PATTERN = /^(Base|Impuesto) \(([\d.]+)\)$/
const RETENIDO_ORDER = ['ISR Retenido', 'IVA Retenido', 'IEPS Retenido']

/** Recolecta columnas de retenciones (ISR Retenido, IVA Retenido, etc.). Solo incluye columnas con al menos un valor distinto de 0. */
export function getRetencionColumns(cfdis: CfdiRow[]): TableColumn[] {
  const idsSet = new Set<string>()
  for (const row of cfdis) {
    for (const key of Object.keys(row)) {
      if (key.endsWith(' Retenido')) idsSet.add(key)
    }
  }
  const ordered = RETENIDO_ORDER.filter((id) => idsSet.has(id))
  const rest = Array.from(idsSet).filter((id) => !RETENIDO_ORDER.includes(id)).sort()
  const ids = [...ordered, ...rest]
  const cols: TableColumn[] = []
  for (const id of ids) {
    const hasNonZero = cfdis.some((row) => {
      const v = row[id]
      return v != null && v !== '' && v !== '0'
    })
    if (hasNonZero) cols.push({ id, label: id })
  }
  return cols
}

/** Recolecta columnas de traslados (Base/Impuesto por TasaOCuota). Solo incluye columnas con al menos un valor distinto de 0. */
export function getTrasladoColumns(cfdis: CfdiRow[]): TableColumn[] {
  const tasasSet = new Set<number>()
  for (const row of cfdis) {
    for (const key of Object.keys(row)) {
      const m = key.match(TRASLADO_PATTERN)
      if (m) tasasSet.add(parseFloat(m[2]))
    }
  }
  const tasas = Array.from(tasasSet).sort((a, b) => b - a)
  const cols: TableColumn[] = []
  for (const t of tasas) {
    const tasaStr = t.toString()
    const baseId = `Base (${tasaStr})`
    const impuestoId = `Impuesto (${tasaStr})`
    const baseHasNonZero = cfdis.some((row) => {
      const v = row[baseId]
      return v != null && v !== '' && v !== '0'
    })
    const impuestoHasNonZero = cfdis.some((row) => {
      const v = row[impuestoId]
      return v != null && v !== '' && v !== '0'
    })
    if (baseHasNonZero) cols.push({ id: baseId, label: baseId })
    if (impuestoHasNonZero) cols.push({ id: impuestoId, label: impuestoId })
  }
  return cols
}

/** Columnas fijas + columnas de traslados + columnas de retenciones según los CFDIs cargados. */
export function getTableColumns(cfdis: CfdiRow[]): TableColumn[] {
  return [...BASE_COLUMNS, ...getTrasladoColumns(cfdis), ...getRetencionColumns(cfdis)]
}

type SortDirection = 'asc' | 'desc'

interface CfdiTableProps {
  cfdis: CfdiRow[]
  columns: TableColumn[]
  hiddenColumnIds: string[]
  onOpenColumnVisibility?: () => void
  onClearTable?: () => void
}

const NUMERIC_COLUMN_KEYWORDS = ['BASE', 'IMPUESTO', 'TOTAL', 'SUBTOTAL', 'DESCUENTO', 'RETENIDO']

function isNumericColumn(colId: string): boolean {
  const upper = colId.toUpperCase()
  return NUMERIC_COLUMN_KEYWORDS.some((kw) => upper.includes(kw))
}

function cellValue(row: CfdiRow, key: string): string {
  const v = row[key]
  if (v === undefined || v === '') return '—'
  return String(v)
}

/** Formatea solo columnas numéricas (BASE, IMPUESTO, TOTAL, SUBTOTAL, DESCUENTO, RETENIDO) con separador de miles (es-MX). */
function formatCellDisplay(raw: string, colId: string): string {
  if (raw === '—' || raw === '') return raw
  if (!isNumericColumn(colId)) return raw
  const n = parseFloat(raw.replace(/,/g, ''))
  if (!Number.isNaN(n)) return n.toLocaleString('es-MX')
  return raw
}

function compareRows(a: CfdiRow, b: CfdiRow, key: string, dir: SortDirection, estadoByUuid?: Record<string, string>): number {
  const va = key === 'Estado' && estadoByUuid ? (estadoByUuid[a.UUID ?? ''] ?? '') : cellValue(a, key)
  const vb = key === 'Estado' && estadoByUuid ? (estadoByUuid[b.UUID ?? ''] ?? '') : cellValue(b, key)
  const sa = va === '—' ? '' : va
  const sb = vb === '—' ? '' : vb
  const cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? cmp : -cmp
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ColumnsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4v16M12 4v16M19 4v16" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function FileSpreadsheetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function SortIcon({ className, dir }: { className?: string; dir: SortDirection | null }) {
  if (dir === 'asc')
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    )
  if (dir === 'desc')
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    )
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" opacity={0.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
}

function getCellDisplayValue(row: CfdiRow, colId: string, estadoByUuid: Record<string, string>): string {
  if (colId === 'Estado') return estadoByUuid[row.UUID ?? ''] ?? '—'
  return cellValue(row, colId)
}

const ESTADO_BADGE_CLASSES: Record<string, string> = {
  Vigente:
    'inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-500/20',
  Cancelado:
    'inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-500/20',
  'No encontrado':
    'inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-500/20',
  Error:
    'inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-500/20',
  'Consultando...':
    'inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/20',
}

function EstadoBadge({ valor }: { valor: string }) {
  if (valor === '—') return <span className="text-neutral-500 dark:text-neutral-400">—</span>
  const badgeClass =
    ESTADO_BADGE_CLASSES[valor] ??
    'inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-500/20'
  return <span className={badgeClass}>{valor}</span>
}

export function CfdiTable({ cfdis, columns, hiddenColumnIds, onOpenColumnVisibility, onClearTable }: CfdiTableProps) {
  const visibleColumns = columns.filter((c) => !hiddenColumnIds.includes(c.id))
  const displayColumns = visibleColumns.length > 0 ? visibleColumns : columns

  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resize, setResize] = useState<{ colId: string; startX: number; startWidth: number } | null>(null)
  const [estadoByUuid, setEstadoByUuid] = useState<Record<string, string>>({})
  const [isConsultando, setIsConsultando] = useState(false)
  const [consultandoProgress, setConsultandoProgress] = useState<{ current: number; total: number } | null>(null)
  const [consultarCooldownSeconds, setConsultarCooldownSeconds] = useState(0)
  const consultarCooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const filteredCfdis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return cfdis
    return cfdis.filter((row) =>
      columns.some((c) => {
        const v = getCellDisplayValue(row, c.id, estadoByUuid)
        if (v === '—') return false
        return v.toLowerCase().includes(q)
      })
    )
  }, [cfdis, searchQuery, columns, estadoByUuid])

  const sortedCfdis = useMemo(() => {
    if (!sortKey) return filteredCfdis
    const arr = [...filteredCfdis]
    arr.sort((a, b) => compareRows(a, b, sortKey, sortDir, estadoByUuid))
    return arr
  }, [filteredCfdis, sortKey, sortDir, estadoByUuid])

  const totalCount = sortedCfdis.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const paginatedCfdis = sortedCfdis.slice(start, start + pageSize)

  /** Cuántas veces aparece cada UUID en todos los CFDIs cargados (para resaltar duplicados). */
  const uuidCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of cfdis) {
      const u = row.UUID?.trim()
      if (u) m.set(u, (m.get(u) ?? 0) + 1)
    }
    return m
  }, [cfdis])

  /** Totales por columna (solo BASE, IMPUESTO, TOTAL, SUBTOTAL) sobre los datos filtrados. */
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const col of displayColumns) {
      if (!isNumericColumn(col.id)) continue
      let sum = 0
      for (const row of filteredCfdis) {
        const v = row[col.id]
        if (v != null && v !== '') {
          const n = parseFloat(String(v).replace(/,/g, ''))
          if (!Number.isNaN(n)) sum += n
        }
      }
      totals[col.id] = sum
    }
    return totals
  }, [displayColumns, filteredCfdis])

  useEffect(() => {
    if (safePage !== page) setPage(safePage)
  }, [totalCount, pageSize, safePage, page])

  useEffect(() => {
    if (cfdis.length === 0) setEstadoByUuid({})
  }, [cfdis.length])

  const toggleSort = (colId: string) => {
    if (sortKey === colId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(colId)
      setSortDir('asc')
    }
    setPage(1)
  }

  const getColWidth = useCallback(
    (colId: string) => columnWidths[colId] ?? DEFAULT_COL_WIDTH,
    [columnWidths]
  )

  useEffect(() => {
    if (!resize) return
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resize.startX
      const newWidth = Math.max(MIN_COL_WIDTH, resize.startWidth + delta)
      setColumnWidths((prev) => ({ ...prev, [resize.colId]: newWidth }))
    }
    const onUp = () => setResize(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resize])

  useEffect(() => {
    return () => {
      if (consultarCooldownIntervalRef.current) clearInterval(consultarCooldownIntervalRef.current)
    }
  }, [])

  const tableMinWidth =
    ROW_NUM_COL_WIDTH + displayColumns.reduce((sum, col) => sum + getColWidth(col.id), 0)
  const getColPercent = useCallback(
    (colId: string) => (tableMinWidth > 0 ? (getColWidth(colId) / tableMinWidth) * 100 : 100 / displayColumns.length),
    [tableMinWidth, getColWidth, displayColumns.length]
  )

  if (cfdis.length === 0) {
    return (
      <div className="w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
        No hay CFDIs cargados. Sube archivos XML para ver la tabla.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Búsqueda global */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setPage(1)
          }}
          placeholder="Buscar en todas las columnas..."
          className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-[#63048C] focus:outline-none focus:ring-2 focus:ring-[#63048C]/20 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-[#b855e8] dark:focus:ring-[#b855e8]/25"
          aria-label="Buscar en todas las columnas"
        />
        {searchQuery && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 dark:text-neutral-400">
            {totalCount} resultado{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Botones arriba de la tabla */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={async () => {
            const seen = new Set<string>()
            const list: { uuid: string; rfc_emisor: string; rfc_receptor: string; total: string }[] = []
            for (const row of cfdis) {
              const uuid = row.UUID?.trim()
              if (!uuid || seen.has(uuid)) continue
              const currentEstado = estadoByUuid[uuid]
              if (currentEstado === 'Vigente' || currentEstado === 'Cancelado') continue
              seen.add(uuid)
              const rfc_emisor = row.EmisorRfc?.trim() ?? ''
              const rfc_receptor = row.ReceptorRfc?.trim() ?? ''
              const totalNum = Number.parseFloat(String(row.Total ?? '').replace(/,/g, ''))
              const total = Number.isNaN(totalNum) ? '0.00' : totalNum.toFixed(2)
              list.push({ uuid, rfc_emisor, rfc_receptor, total })
            }
            if (list.length === 0) return
            setIsConsultando(true)
            setEstadoByUuid((prev) => {
              const next = { ...prev }
              for (const { uuid } of list) next[uuid] = 'Consultando...'
              return next
            })
            setConsultandoProgress({ current: 0, total: list.length })
            const promises = list.map((item) =>
              consultaCfdiSat(item).then((estado) => ({ uuid: item.uuid, estado }))
            )
            const settled = await Promise.allSettled(promises)
            const updates: Record<string, string> = {}
            settled.forEach((result, i) => {
              const uuid = list[i].uuid
              updates[uuid] = result.status === 'fulfilled' ? result.value.estado : 'Error'
            })
            setEstadoByUuid((prev) => ({ ...prev, ...updates }))
            setIsConsultando(false)
            setConsultandoProgress(null)
            if (consultarCooldownIntervalRef.current) clearInterval(consultarCooldownIntervalRef.current)
            setConsultarCooldownSeconds(5)
            consultarCooldownIntervalRef.current = setInterval(() => {
              setConsultarCooldownSeconds((prev) => {
                if (prev <= 1) {
                  if (consultarCooldownIntervalRef.current) {
                    clearInterval(consultarCooldownIntervalRef.current)
                    consultarCooldownIntervalRef.current = null
                  }
                  return 0
                }
                return prev - 1
              })
            }, 1000)
          }}
          disabled={isConsultando || consultarCooldownSeconds > 0}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-800 shadow-sm transition-colors hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#63048C] focus:ring-offset-1 disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 dark:focus:ring-offset-neutral-900"
          title="Consultar estado de cada CFDI en el SAT"
        >
          {consultandoProgress != null ? (
            <>Consultando...</>
          ) : consultarCooldownSeconds > 0 ? (
            <span className="tabular-nums">Espere {consultarCooldownSeconds} s</span>
          ) : (
            <>Consultar en el SAT</>
          )}
        </button>
        <button
          type="button"
          onClick={async () => {
            await exportTableToExcel(sortedCfdis, columns, 'cfdis.xlsx', estadoByUuid)
          }}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-800 shadow-sm transition-colors hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#63048C] focus:ring-offset-1 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 dark:focus:ring-offset-neutral-900"
          title="Descargar tabla como Excel"
        >
          <FileSpreadsheetIcon className="h-4 w-4" />
          Exportar Excel
        </button>
        {onOpenColumnVisibility && (
          <button
            type="button"
            onClick={onOpenColumnVisibility}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-800 shadow-sm transition-colors hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#63048C] focus:ring-offset-1 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 dark:focus:ring-offset-neutral-900"
          >
            <ColumnsIcon className="h-4 w-4" />
            Columnas
          </button>
        )}
        {onClearTable && (
          <button
            type="button"
            onClick={onClearTable}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-800 shadow-sm transition-colors hover:bg-red-100 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-red-900/30 dark:hover:border-red-800 dark:focus:ring-offset-neutral-900"
            title="Vaciar la tabla de CFDIs"
          >
            <TrashIcon className="h-4 w-4" />
            Limpiar tabla
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="mb-4 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800">
        <table className="w-full table-fixed border-collapse text-[0.8125rem]" style={{ minWidth: tableMinWidth }}>
          <colgroup>
            <col style={{ width: ROW_NUM_COL_WIDTH, minWidth: ROW_NUM_COL_WIDTH }} />
            {displayColumns.map((col) => (
              <col key={col.id} style={{ width: `${getColPercent(col.id)}%`, minWidth: MIN_COL_WIDTH }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-[#63048C]/25 bg-[#63048C]/5 dark:border-[#b855e8]/35 dark:bg-[#b855e8]/10">
            <tr>
              <th className="bg-[#63048C]/5 px-2 py-2 text-center align-middle text-xs font-bold uppercase tracking-wide text-[#63048C] dark:bg-[#b855e8]/10 dark:text-white">
                #
              </th>
              {displayColumns.map((col) => (
                <th
                  key={col.id}
                  className={`relative overflow-hidden bg-[#63048C]/5 align-middle dark:bg-[#b855e8]/10 ${col.id === 'Estado' ? 'text-center' : ''} ${isNumericColumn(col.id) ? 'text-right' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.id)}
                    className={`flex w-full min-w-0 items-center gap-1 overflow-hidden px-2 py-2 pr-6 text-xs font-bold uppercase tracking-wide text-[#63048C] hover:bg-[#63048C]/10 dark:text-white dark:hover:bg-[#b855e8]/15 ${col.id === 'Estado' ? 'justify-center' : isNumericColumn(col.id) ? 'justify-end text-right' : 'text-left'}`}
                    title="Ordenar por esta columna"
                  >
                    <span className="min-w-0 flex-1 truncate">{col.label}</span>
                    <SortIcon className="h-4 w-4 shrink-0" dir={sortKey === col.id ? sortDir : null} />
                  </button>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setResize({ colId: col.id, startX: e.clientX, startWidth: getColWidth(col.id) })
                    }}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#63048C]/25 dark:hover:bg-[#b855e8]/35"
                    title="Redimensionar columna"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedCfdis.length === 0 ? (
              <tr>
                <td
                  colSpan={displayColumns.length + 1}
                  className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  No hay resultados para la búsqueda actual.
                </td>
              </tr>
            ) : (
              paginatedCfdis.map((row, index) => {
                const uuid = row.UUID?.trim()
                const isDuplicateUuid = Boolean(uuid && (uuidCounts.get(uuid) ?? 0) > 1)
                return (
                <tr
                  key={`${start}-${index}`}
                  className={`border-b border-neutral-200 transition-colors dark:border-neutral-600 ${
                    isDuplicateUuid
                      ? 'bg-red-100 hover:bg-red-200 dark:bg-red-950/55 dark:hover:bg-red-900/70'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                  }`}
                  title={isDuplicateUuid ? 'UUID duplicado: este comprobante aparece más de una vez' : undefined}
                >
                  <td className="align-middle border-r border-neutral-200 px-1.5 py-1 text-center tabular-nums text-neutral-600 dark:border-neutral-600 dark:text-white">
                    {start + index + 1}
                  </td>
                  {displayColumns.map((col) => {
                    const isFecha = col.id === 'Fecha'
                    const isNumeric = isNumericColumn(col.id)
                    return (
                    <td
                      key={col.id}
                      className={`align-middle border-r border-neutral-200 px-1.5 py-1 text-neutral-800 last:border-r-0 dark:border-neutral-600 dark:text-white ${
                        col.id === 'Estado' ? 'text-center' : ''
                      } ${isNumeric ? 'text-right tabular-nums' : ''} ${isFecha
                          ? 'cursor-default transition-colors duration-200 hover:bg-[#63048C]/10 dark:hover:bg-[#b855e8]/15'
                          : ''
                      }`}
                    >
                      <span
                        className={`block overflow-hidden text-ellipsis whitespace-nowrap ${
                          col.id === 'Estado' ? 'flex justify-center' : ''
                        } ${isFecha
                            ? 'rounded px-0.5 transition-all duration-200 hover:scale-[1.03] hover:font-medium hover:text-[#63048C] hover:underline hover:decoration-[#63048C] hover:underline-offset-2 dark:hover:text-[#b855e8] dark:hover:decoration-[#b855e8]'
                            : ''
                        }`}
                      >
                        {col.id === 'Estado'
                          ? <EstadoBadge valor={getCellDisplayValue(row, col.id, estadoByUuid)} />
                          : formatCellDisplay(cellValue(row, col.id), col.id)}
                      </span>
                    </td>
                  )})}
                </tr>
              )})
            )}
          </tbody>
          {totalCount > 0 && (
          <tfoot className="border-t border-neutral-200 dark:border-neutral-600">
            <tr>
              <td className="border-r border-neutral-200 px-1.5 py-2 text-right text-xs font-medium text-green-700 dark:border-neutral-600 dark:text-green-400">
                Total
              </td>
              {displayColumns.map((col) => {
                const total = columnTotals[col.id]
                const showTotal = total !== undefined
                return (
                  <td
                    key={col.id}
                    className="align-middle border-r border-neutral-200 px-1.5 py-2 text-right tabular-nums text-green-700 last:border-r-0 dark:border-neutral-600 dark:text-green-400"
                  >
                    {showTotal ? total.toLocaleString('es-MX') : '—'}
                  </td>
                )
              })}
            </tr>
          </tfoot>
          )}
        </table>
      </div>

      {/* Paginación abajo de la tabla */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Mostrando {totalCount === 0 ? 0 : start + 1}–{Math.min(start + pageSize, totalCount)} de {totalCount}{' '}
            CFDIs
            {searchQuery && totalCount !== cfdis.length && (
              <span className="text-neutral-500 dark:text-neutral-500"> (de {cfdis.length} total)</span>
            )}
          </span>
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            Filas por página
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="rounded border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
          >
            Siguiente
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
