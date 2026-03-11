/**
 * Parser CFDI. Extrae Comprobante, Emisor, Receptor, TimbreFiscalDigital,
 * impuestos trasladados (Traslados) y retenciones (Retenciones) a nivel comprobante.
 */

const CFDI_NS = 'http://www.sat.gob.mx/cfd/4'
const TFD_NS = 'http://www.sat.gob.mx/TimbreFiscalDigital'

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

export function parseCfdiXml(xmlString: string): ParseResult {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'text/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      return { ok: false, error: 'XML inválido' }
    }

    const comprobanteList = doc.getElementsByTagNameNS(CFDI_NS, 'Comprobante')
    const comprobante = comprobanteList[0] ?? null
    if (!comprobante) {
      return { ok: false, error: 'No se encontró nodo Comprobante' }
    }

    const emisorList = doc.getElementsByTagNameNS(CFDI_NS, 'Emisor')
    const emisor = emisorList[0] ?? null

    const receptorList = doc.getElementsByTagNameNS(CFDI_NS, 'Receptor')
    const receptor = receptorList[0] ?? null

    const tfdList = doc.getElementsByTagNameNS(TFD_NS, 'TimbreFiscalDigital')
    const tfd = tfdList[0] ?? null

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

    // Impuestos trasladados y retenciones: solo Comprobante > Impuestos (no los de Conceptos)
    const impuestosComprobante = Array.from(comprobante.children).find(
      (el) => el.namespaceURI === CFDI_NS && el.localName === 'Impuestos'
    )
    if (impuestosComprobante) {
      const traslados = impuestosComprobante.getElementsByTagNameNS(CFDI_NS, 'Traslado')
      for (let i = 0; i < traslados.length; i++) {
        const t = traslados[i]
        const base = getAttr(t, 'Base')
        const tasaRaw = getAttr(t, 'TasaOCuota')
        const importe = getAttr(t, 'Importe')
        if (tasaRaw != null) {
          const tasa = parseFloat(tasaRaw).toString()
          if (base != null && base !== '0') row[`Base (${tasa})`] = base
          if (importe != null && importe !== '0') row[`Impuesto (${tasa})`] = importe
        }
      }
      // Retenciones: cfdi:Retencion Importe, Impuesto (001=ISR, 002=IVA, 003=IEPS)
      const IMPUESTO_RETENIDO_NAMES: Record<string, string> = {
        '001': 'ISR',
        '002': 'IVA',
        '003': 'IEPS',
      }
      const retenciones = impuestosComprobante.getElementsByTagNameNS(CFDI_NS, 'Retencion')
      for (let i = 0; i < retenciones.length; i++) {
        const r = retenciones[i]
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
