import { useRef, useState } from 'react'
import { readFileAsText } from '../utils/readFileAsText'
import { parseCfdiXml } from '../lib/cfdiParser'
import type { CfdiRow } from '../lib/cfdiParser'

const BATCH_SIZE = 80

export interface ProcessError {
  fileName: string
  error: string
}

interface FileUploaderProps {
  onResults: (cfdis: CfdiRow[], errors: ProcessError[]) => void
  disabled?: boolean
}

export function FileUploader({ onResults, disabled }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  async function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.xml'))
    if (fileArray.length === 0) {
      onResults([], [{ fileName: '', error: 'No se seleccionaron archivos XML.' }])
      return
    }

    setProgress({ current: 0, total: fileArray.length })
    const results: CfdiRow[] = []
    const errors: ProcessError[] = []

    for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
      const batch = fileArray.slice(i, i + BATCH_SIZE)
      for (const file of batch) {
        try {
          const text = await readFileAsText(file)
          const parsed = parseCfdiXml(text)
          if (parsed.ok) {
            results.push(parsed.data)
          } else {
            errors.push({ fileName: file.name, error: parsed.error })
          }
        } catch {
          errors.push({ fileName: file.name, error: 'Error al leer el archivo' })
        }
      }
      const done = Math.min(i + BATCH_SIZE, fileArray.length)
      setProgress({ current: done, total: fileArray.length })
      if (i + BATCH_SIZE < fileArray.length) {
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    setProgress(null)
    onResults(results, errors)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files?.length) processFiles(files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const files = e.dataTransfer.files
    if (files?.length) processFiles(files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(!disabled)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-[#63048C] dark:border-[#b855e8] bg-[#63048C]/10 dark:bg-[#b855e8]/15' : 'border-[#63048C]/70 dark:border-[#b855e8]/70 hover:border-[#63048C] dark:hover:border-[#b855e8] hover:bg-[#63048C]/5 dark:hover:bg-[#b855e8]/10'}
          ${disabled ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        <p className="text-neutral-600 dark:text-neutral-400">
          Arrastra archivos XML aquí o haz clic para seleccionar
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
          Acepta múltiples archivos .xml
        </p>
      </div>

      {progress && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#63048C] dark:bg-[#b855e8] transition-all duration-200"
              style={{ width: `${(100 * progress.current) / progress.total}%` }}
            />
          </div>
          <span className="text-sm text-neutral-600 dark:text-neutral-400 tabular-nums">
            {progress.current} / {progress.total}
          </span>
        </div>
      )}
    </div>
  )
}
