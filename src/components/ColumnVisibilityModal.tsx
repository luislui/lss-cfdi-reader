import { useState, useEffect } from 'react'

export interface ColumnItem {
  id: string
  label: string
}

interface ColumnVisibilityModalProps {
  columns: ColumnItem[]
  hiddenColumnIds: string[]
  onSave: (hiddenIds: string[]) => void
  onCancel: () => void
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function ColumnVisibilityModal({
  columns,
  hiddenColumnIds,
  onSave,
  onCancel,
}: ColumnVisibilityModalProps) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(hiddenColumnIds))

  useEffect(() => {
    setHidden(new Set(hiddenColumnIds))
  }, [hiddenColumnIds])

  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const showAll = () => setHidden(new Set())
  const hideAll = () => setHidden(new Set(columns.map((c) => c.id)))

  const handleSave = () => {
    onSave(Array.from(hidden))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="column-visibility-title"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-600 dark:bg-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-600">
          <h2 id="column-visibility-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Mostrar u ocultar columnas
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-600 dark:hover:text-neutral-200"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="border-b border-neutral-200 px-4 py-2 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
          Desmarca la columna para ocultarla en la tabla. La configuración se guarda en este navegador.
        </p>
        <div className="flex gap-2 border-b border-neutral-200 px-4 py-2 dark:border-neutral-600">
          <button
            type="button"
            onClick={showAll}
            className="rounded border border-neutral-400 bg-neutral-100 px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200"
          >
            Mostrar todas
          </button>
          <button
            type="button"
            onClick={hideAll}
            className="rounded border border-neutral-400 bg-neutral-100 px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200"
          >
            Ocultar todas
          </button>
        </div>
        <div className="max-h-[45vh] overflow-y-auto p-4">
          <ul className="space-y-1">
            {columns.map((col) => (
              <li key={col.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`col-${col.id}`}
                  checked={!hidden.has(col.id)}
                  onChange={() => toggle(col.id)}
                  className="rounded border-neutral-300 dark:border-neutral-500 dark:bg-neutral-700"
                />
                <label
                  htmlFor={`col-${col.id}`}
                  className="cursor-pointer text-sm text-neutral-800 dark:text-neutral-200"
                >
                  {col.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-600">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md border border-[#63048C] bg-[#63048C] px-3 py-1.5 text-sm text-white hover:bg-[#7a05a8] dark:border-[#b855e8] dark:bg-[#b855e8] dark:hover:bg-[#c77af0]"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
