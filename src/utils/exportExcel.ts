import * as XLSX from 'xlsx'
import type { CfdiRow } from '../lib/cfdiParser'

interface TableColumnExport {
  id: string
  label: string
}

const NUMERIC_KEYWORDS = ['BASE', 'IMPUESTO', 'TOTAL', 'SUBTOTAL', 'DESCUENTO', 'RETENIDO']

function isNumericColumn(colId: string): boolean {
  const upper = colId.toUpperCase()
  return NUMERIC_KEYWORDS.some((kw) => upper.includes(kw))
}

function getExportValue(row: CfdiRow, colId: string): string | number {
  const v = row[colId]
  if (v === undefined || v === '') return ''
  if (isNumericColumn(colId)) {
    const n = parseFloat(String(v).replace(/,/g, ''))
    if (!Number.isNaN(n)) return n
  }
  return String(v)
}

/**
 * Genera y descarga un Excel con los CFDIs: primera fila = encabezados,
 * filas de datos y última fila = totales para columnas numéricas.
 */
export function exportTableToExcel(rows: CfdiRow[], columns: TableColumnExport[], filename = 'cfdis.xlsx'): void {
  const headers = columns.map((c) => c.label)
  const dataRows: (string | number)[][] = rows.map((row) =>
    columns.map((col) => getExportValue(row, col.id))
  )

  const aoa: (string | number)[][] = [headers, ...dataRows]
  if (rows.length > 0) {
    const totalLabel = 'Total'
    const totals: (string | number)[] = columns.map((col, i) => {
      if (i === 0) return totalLabel
      if (!isNumericColumn(col.id)) return ''
      let sum = 0
      for (const row of rows) {
        const v = row[col.id]
        if (v != null && v !== '') {
          const n = parseFloat(String(v).replace(/,/g, ''))
          if (!Number.isNaN(n)) sum += n
        }
      }
      return sum
    })
    aoa.push(totals)
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'CFDIs')
  XLSX.writeFile(wb, filename)
}
