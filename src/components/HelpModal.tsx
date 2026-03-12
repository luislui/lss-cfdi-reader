interface HelpModalProps {
  open: boolean
  onClose: () => void
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-600 dark:bg-neutral-800">
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-600 dark:bg-neutral-800">
          <h2 id="help-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Ayuda
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-600 dark:hover:text-neutral-200"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-4 text-sm text-neutral-700 dark:text-neutral-300">
          <section>
            <h3 className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">Carga de CFDIs</h3>
            <p className="mb-0">
              Arrastra uno o varios archivos XML de CFDIs (versión 4.0) a la zona de carga o haz clic para
              seleccionarlos. La tabla mostrará los datos del comprobante, emisor, receptor, totales e impuestos.
            </p>
          </section>
          <section>
            <h3 className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">Tabla</h3>
            <p className="mb-0">
              Puedes buscar por cualquier columna, ordenar haciendo clic en el encabezado y mostrar u ocultar
              columnas. Los CFDIs con el mismo UUID se marcan como duplicados. La exportación a Excel incluye el
              estado del CFDI si lo consultaste en el SAT.
            </p>
          </section>
          <section>
            <h3 className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">Consulta estado en el SAT</h3>
            <p className="mb-2">
              Usa el botón &quot;Consultar en el SAT&quot; para verificar el estado de cada CFDI (Vigente, Cancelado,
              No encontrado o Error). Los que ya estén Vigente o Cancelado no se vuelven a consultar.
            </p>
            <p className="mb-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
              <strong>Nota:</strong> Puede haber intermitencia en la consulta del estado debido al servicio del SAT.
              Si obtienes &quot;Error&quot; o no hay respuesta, vuelve a intentar más tarde.
            </p>
          </section>
          <section>
            <h3 className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">Tema</h3>
            <p className="mb-0">
              El botón en la esquina superior derecha del encabezado alterna entre modo claro y oscuro. La
              preferencia se guarda en tu navegador.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
