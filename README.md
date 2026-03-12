# LSS Lector de CFDIs

Visualizador de Comprobantes Fiscales Digitales por Internet (CFDI) del SAT (México). Carga archivos XML, muestra la información en tabla, consulta el estado en el SAT y permite exportar a Excel.

**Versión:** 1.1.0

Desarrollado por [Loeram Software Solutions](https://www.loeramsoft.com).

## Demo en producción

Puedes usar la versión en línea en: [app.loeramsoft.com](https://app.loeramsoft.com)

## Características

- **Carga de XML**: Arrastra o selecciona uno o varios archivos `.xml` de CFDIs (versión 4.0).
- **Tabla interactiva**: Columnas de comprobante, emisor, receptor, totales, impuestos, etc.
- **Columnas dinámicas**:
  - **Traslados**: Base e Impuesto por tasa (ej. Base (0.16), Impuesto (0.16)).
  - **Retenciones**: ISR, IVA e IEPS retenidos según el XML.
- **Columnas numéricas**: SubTotal, Total, Descuento, bases e impuestos con separador de miles y fila de totales al final.
- **Búsqueda**: Filtra por cualquier columna visible.
- **Ordenación**: Clic en el encabezado para ordenar (asc/desc).
- **Visibilidad de columnas**: Mostrar u ocultar columnas; la preferencia se guarda en el navegador.
- **Consulta estado en el SAT**: Columna Estado y botón para consultar cada CFDI en el SAT (vía backend). Vigente, Cancelado, No encontrado o Error; no se reconsultan los que ya están Vigente o Cancelado.
- **Exportar a Excel**: Descarga un archivo `.xlsx` con los datos visibles (orden y filtro actuales), incluyendo el estado del CFDI si se consultó, y fila de totales.
- **Tema claro/oscuro**: Con persistencia en `localStorage`.
- **Duplicados**: Los comprobantes con el mismo UUID se resaltan en rojo.

## Configuración (opcional)

- **`VITE_LSS_SAT_STATUS_API_URL`**: URL base del backend de consulta de estado en el SAT (lssb-cfdi-satstatus). Si no se define, se usa el mismo origen (`/api/v1/sat/cfdi/status`). En local con el backend en otro puerto: `VITE_LSS_SAT_STATUS_API_URL=http://localhost:8080`.

## Requisitos

- Node.js 18+
- pnpm (recomendado) o npm

## Instalación y ejecución

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:5173](http://localhost:5173) en el navegador.

## Scripts

| Comando     | Descripción              |
|------------|--------------------------|
| `pnpm dev` | Servidor de desarrollo   |
| `pnpm build` | Compilación para producción |
| `pnpm preview` | Vista previa del build   |
| `pnpm lint` | Ejecutar ESLint          |

## Estructura del proyecto

```
src/
├── App.tsx                 # Raíz de la aplicación
├── main.tsx
├── components/
│   ├── CfdiTable.tsx       # Tabla, columnas dinámicas, export Excel
│   ├── FileUploader.tsx    # Zona de arrastre y selección de XML
│   ├── ColumnVisibilityModal.tsx
│   ├── ConfirmClearModal.tsx
│   └── HelpModal.tsx        # Ayuda (consulta SAT, intermitencia, etc.)
├── lib/
│   ├── cfdiParser.ts       # Parser XML → datos del comprobante
│   └── satConsultaApi.ts   # Cliente al backend de consulta estado SAT (JSON)
└── utils/
    ├── exportExcel.ts      # Exportación a .xlsx (xlsx/SheetJS)
    ├── cfdiColumnVisibility.ts
    ├── themeStorage.ts
    └── readFileAsText.ts
```

## Tecnologías

- React 19, TypeScript, Vite
- Tailwind CSS 4
- SheetJS (xlsx) para exportar Excel
- react-hot-toast para notificaciones

## Formato soportado

- CFDI 4.0 (namespace `http://www.sat.gob.mx/cfd/4`).
- Se leen Comprobante, Emisor, Receptor, TimbreFiscalDigital, Impuestos (Traslados y Retenciones a nivel comprobante).
