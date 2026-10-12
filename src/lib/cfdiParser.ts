/**
 * Parser CFDI 3.3 y 4.0. Extrae Comprobante, Emisor, Receptor, TimbreFiscalDigital,
 * impuestos trasladados (Traslados) y retenciones (Retenciones) a nivel comprobante.
 *
 * En 3.3 el Traslado del comprobante no trae Base (Anexo 20); esa base se suma
 * desde los traslados de cada Concepto con el mismo impuesto y tasa.
 */

const CFDI_NS_40 = 'http://www.sat.gob.mx/cfd/4'
const CFDI_NS_33 = 'http://www.sat.gob.mx/cfd/3'
const TFD_NS = 'http://www.sat.gob.mx/TimbreFiscalDigital'
const SUPPORTED_VERSIONS = new Set(['3.3', '4.0'])

export interface CfdiRow {
  Version?: string
  Serie?: string
  Folio?: string
  Fecha?: string
  SubTotal?: string
  Total?: string
  Moneda?: string
  TipoDeComprobante?: string
  FormaPago?: string
  MetodoPago?: string
  LugarExpedicion?: string
  CondicionesDePago?: string
  Exportacion?: string
  EmisorRfc?: string
  EmisorNombre?: string
  EmisorRegimenFiscal?: string
  ReceptorRfc?: string
  ReceptorNombre?: string
  DomicilioFiscalReceptor?: string
  RegimenFiscalReceptor?: string
  UsoCFDI?: string
  UUID?: string
  FechaTimbrado?: string
  RfcProvCertif?: string
  /** Columnas dinámicas por TasaOCuota: "Base (0.16)", "Impuesto (0.16)", etc. */
  [key: string]: string | undefined
}

export type ParseResult = { ok: true; data: CfdiRow } | { ok: false; error: string }

function getAttr(el: Element | null, name: string): string | undefined {
  if (!el) return undefined
  const val = el.getAttribute(name)
  return val ?? undefined
}

function firstChildNS(parent: Element, ns: string, localName: string): Element | null {
  for (const el of parent.children) {
    if (el.namespaceURI === ns && el.localName === localName) return el
  }
  return null
}

function childElementsNS(parent: Element, ns: string, localName: string): Element[] {
  return Array.from(parent.children).filter(
    (el) => el.namespaceURI === ns && el.localName === localName,
  )
}

function findComprobante(doc: Document): Element | null {
  return (
    doc.getElementsByTagNameNS(CFDI_NS_40, 'Comprobante')[0] ??
    doc.getElementsByTagNameNS(CFDI_NS_33, 'Comprobante')[0] ??
    null
  )
}

/** Bases de traslados de conceptos, agrupadas por impuesto y tasa normalizada. */
function conceptBasesByTax(comprobante: Element, ns: string): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  const conceptos = firstChildNS(comprobante, ns, 'Conceptos')
  if (!conceptos) return grouped

  for (const concepto of childElementsNS(conceptos, ns, 'Concepto')) {
    const impuestos = firstChildNS(concepto, ns, 'Impuestos')
    const traslados = impuestos ? firstChildNS(impuestos, ns, 'Traslados') : null
    if (!traslados) continue
    for (const traslado of childElementsNS(traslados, ns, 'Traslado')) {
      const tasaRaw = getAttr(traslado, 'TasaOCuota')
      const base = getAttr(traslado, 'Base')
      if (tasaRaw == null || base == null || base === '0') continue
      const tasa = parseFloat(tasaRaw)
      if (Number.isNaN(tasa)) continue
      const key = `${getAttr(traslado, 'Impuesto') ?? ''}|${tasa}`
      const list = grouped.get(key)
      if (list) list.push(base)
      else grouped.set(key, [base])
    }
  }
  return grouped
}

/** Suma importes con 6 decimales, el máximo del Anexo 20, sin arrastre binario. */
function sumAmounts(values: string[]): string {
  let millionths = 0
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n)) millionths += Math.round(n * 1_000_000)
  }
  const sign = millionths < 0 ? '-' : ''
  const abs = Math.abs(millionths)
  const whole = Math.floor(abs / 1_000_000)
  const frac = String(abs % 1_000_000).padStart(6, '0').replace(/0+$/, '')
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`
}

export function parseCfdiXml(xmlString: string): ParseResult {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'text/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      return { ok: false, error: 'XML inválido' }
    }

    const comprobante = findComprobante(doc)
    if (!comprobante) {
      return { ok: false, error: 'No se encontró nodo Comprobante' }
    }

    const version = getAttr(comprobante, 'Version')
    if (!version || !SUPPORTED_VERSIONS.has(version)) {
      return {
        ok: false,
        error: version
          ? `Versión de CFDI no soportada: ${version}`
          : 'Versión de CFDI no soportada',
      }
    }

    const ns = comprobante.namespaceURI ?? CFDI_NS_40
    const emisor = firstChildNS(comprobante, ns, 'Emisor')
    const receptor = firstChildNS(comprobante, ns, 'Receptor')
    const tfd = comprobante.getElementsByTagNameNS(TFD_NS, 'TimbreFiscalDigital')[0] ?? null

    const row: CfdiRow = {
      Version: getAttr(comprobante, 'Version'),
      Serie: getAttr(comprobante, 'Serie'),
      Folio: getAttr(comprobante, 'Folio'),
      Fecha: getAttr(comprobante, 'Fecha'),
      SubTotal: getAttr(comprobante, 'SubTotal'),
      Descuento: getAttr(comprobante, 'Descuento'),
      Total: getAttr(comprobante, 'Total'),
      Moneda: getAttr(comprobante, 'Moneda'),
      TipoCambio: getAttr(comprobante, 'TipoCambio'),
      TipoDeComprobante: getAttr(comprobante, 'TipoDeComprobante'),
      FormaPago: getAttr(comprobante, 'FormaPago'),
      MetodoPago: getAttr(comprobante, 'MetodoPago'),
      LugarExpedicion: getAttr(comprobante, 'LugarExpedicion'),
      CondicionesDePago: getAttr(comprobante, 'CondicionesDePago'),
      Exportacion: getAttr(comprobante, 'Exportacion'),
      EmisorRfc: getAttr(emisor, 'Rfc'),
      EmisorNombre: getAttr(emisor, 'Nombre'),
      EmisorRegimenFiscal: getAttr(emisor, 'RegimenFiscal'),
      ReceptorRfc: getAttr(receptor, 'Rfc'),
      ReceptorNombre: getAttr(receptor, 'Nombre'),
      DomicilioFiscalReceptor: getAttr(receptor, 'DomicilioFiscalReceptor'),
      RegimenFiscalReceptor: getAttr(receptor, 'RegimenFiscalReceptor'),
      UsoCFDI: getAttr(receptor, 'UsoCFDI'),
      UUID: getAttr(tfd, 'UUID'),
      FechaTimbrado: getAttr(tfd, 'FechaTimbrado'),
      RfcProvCertif: getAttr(tfd, 'RfcProvCertif'),
    }

    // Impuestos del comprobante. En 3.3 el traslado no incluye Base; se toma de los conceptos.
    const impuestosComprobante = firstChildNS(comprobante, ns, 'Impuestos')
    if (impuestosComprobante) {
      const conceptBases = conceptBasesByTax(comprobante, ns)
      const trasladosNode = firstChildNS(impuestosComprobante, ns, 'Traslados')
      const traslados = trasladosNode ? childElementsNS(trasladosNode, ns, 'Traslado') : []
      for (const t of traslados) {
        const tasaRaw = getAttr(t, 'TasaOCuota')
        if (tasaRaw == null) continue
        const tasaNum = parseFloat(tasaRaw)
        if (Number.isNaN(tasaNum)) continue
        const tasa = tasaNum.toString()
        let base = getAttr(t, 'Base')
        if (base == null || base === '0') {
          const fromConceptos = conceptBases.get(`${getAttr(t, 'Impuesto') ?? ''}|${tasaNum}`)
          if (fromConceptos?.length) {
            base = fromConceptos.length === 1 ? fromConceptos[0] : sumAmounts(fromConceptos)
          }
        }
        const importe = getAttr(t, 'Importe')
        if (base != null && base !== '0') row[`Base (${tasa})`] = base
        if (importe != null && importe !== '0') row[`Impuesto (${tasa})`] = importe
      }
      // Retenciones: cfdi:Retencion Importe, Impuesto (001=ISR, 002=IVA, 003=IEPS)
      const IMPUESTO_RETENIDO_NAMES: Record<string, string> = {
        '001': 'ISR',
        '002': 'IVA',
        '003': 'IEPS',
      }
      const retencionesNode = firstChildNS(impuestosComprobante, ns, 'Retenciones')
      const retenciones = retencionesNode ? childElementsNS(retencionesNode, ns, 'Retencion') : []
      for (const r of retenciones) {
        const codigo = getAttr(r, 'Impuesto')
        const importe = getAttr(r, 'Importe')
        if (codigo != null && importe != null && importe !== '0') {
          const nombre = IMPUESTO_RETENIDO_NAMES[codigo] ?? codigo
          row[`${nombre} Retenido`] = importe
        }
      }
    }

    return { ok: true, data: row }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido'
    return { ok: false, error: message }
  }
}
