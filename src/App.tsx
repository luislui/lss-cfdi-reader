import { useState, useEffect, useMemo } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { LSS_THEME_STORAGE_KEY, LSS_THEME_DARK, LSS_THEME_LIGHT } from './utils/themeStorage'
import { getHiddenColumnIds, setHiddenColumnIds } from './utils/cfdiColumnVisibility'
import { FileUploader } from './components/FileUploader'
import { CfdiTable, getTableColumns } from './components/CfdiTable'
import { ColumnVisibilityModal } from './components/ColumnVisibilityModal'
import { ConfirmClearModal } from './components/ConfirmClearModal'
import type { CfdiRow } from './lib/cfdiParser'
import type { ProcessError } from './components/FileUploader'
import logoShort from './assets/images/logo_loeram_short.png'
import './App.css'
import { APP_VERSION } from './version'

function App() {
  const [cfdis, setCfdis] = useState<CfdiRow[]>([])
  const [loadErrors, setLoadErrors] = useState<ProcessError[]>([])
  const [hiddenColumnIds, setHiddenColumnIdsState] = useState<string[]>(getHiddenColumnIds)
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const tableColumns = useMemo(() => getTableColumns(cfdis), [cfdis])

  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(LSS_THEME_STORAGE_KEY)
    if (stored) return stored === LSS_THEME_DARK
    return true
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem(LSS_THEME_STORAGE_KEY, LSS_THEME_DARK)
    } else {
      root.classList.remove('dark')
      localStorage.setItem(LSS_THEME_STORAGE_KEY, LSS_THEME_LIGHT)
    }
  }, [dark])

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-colors">
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <header className="border-b border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm sticky top-0 z-10 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex shrink-0 items-center gap-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
              aria-label="Volver al inicio"
            >
              <ArrowLeftIcon className="h-6 w-6" />
              <img src={logoShort} alt="Loeram" className="h-10 w-auto object-contain" />
            </a>
            <div>
              <h1 className="m-0 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                LSS lector de CFDIs
              </h1>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-500">
                v{APP_VERSION}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Carga archivos XML de CFDIs y visualiza la información en tabla
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            title={dark ? 'Modo claro' : 'Modo oscuro'}
            aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {dark ? (
              <SunIcon className="w-5 h-5" />
            ) : (
              <MoonIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 py-4 space-y-6">
          <FileUploader
            onResults={(results, errors) => {
              setCfdis((prev) => [...prev, ...results])
              setLoadErrors((prev) => [...prev, ...errors])
              if (results.length > 0) toast.success(`${results.length} CFDIs cargados`)
              if (errors.length > 0) toast.error(`${errors.length} archivo(s) con error`)
            }}
          />
          {loadErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Errores al procesar ({loadErrors.length}): {loadErrors.slice(0, 3).map((e) => e.fileName || e.error).join(', ')}
                {loadErrors.length > 3 ? ` y ${loadErrors.length - 3} más` : ''}
              </p>
            </div>
          )}
        </div>
        <div className="flex-1 w-full min-h-0 px-4 pb-4">
          <CfdiTable
            cfdis={cfdis}
            columns={tableColumns}
            hiddenColumnIds={hiddenColumnIds}
            onOpenColumnVisibility={() => setColumnVisibilityOpen(true)}
            onClearTable={() => setClearConfirmOpen(true)}
          />
        </div>
        <ConfirmClearModal
          open={clearConfirmOpen}
          onConfirm={() => {
            setCfdis([])
            setLoadErrors([])
            setClearConfirmOpen(false)
            toast.success('Tabla limpiada')
          }}
          onCancel={() => setClearConfirmOpen(false)}
        />
        {columnVisibilityOpen && (
          <ColumnVisibilityModal
            columns={tableColumns.map((c) => ({ id: c.id, label: c.label }))}
            hiddenColumnIds={hiddenColumnIds}
            onSave={(hiddenIds) => {
              setHiddenColumnIdsState(hiddenIds)
              setHiddenColumnIds(hiddenIds)
              setColumnVisibilityOpen(false)
            }}
            onCancel={() => setColumnVisibilityOpen(false)}
          />
        )}
      </main>

      <footer className="mt-auto border-t border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 px-6 py-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
        <a
          href="https://www.loeramsoft.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#63048C] dark:hover:text-[#b855e8] transition-colors"
        >
          Loeram Software Solutions
        </a>
      </footer>
    </div>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

export default App
