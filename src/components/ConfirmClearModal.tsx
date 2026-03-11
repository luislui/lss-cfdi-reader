import type { ReactNode } from 'react'

interface ConfirmClearModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title?: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function ConfirmClearModal({
  open,
  onConfirm,
  onCancel,
  title = '¿Limpiar tabla?',
  message = 'Se eliminarán todos los CFDIs cargados. Esta acción no se puede deshacer.',
  confirmLabel = 'Limpiar tabla',
  cancelLabel = 'Cancelar',
}: ConfirmClearModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-clear-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-600 dark:bg-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-600">
          <h2 id="confirm-clear-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
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
        <p className="px-4 py-4 text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-600">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md border border-red-600 bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-600 dark:hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
