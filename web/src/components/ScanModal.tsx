import { useState } from 'react'

interface ScanModalProps {
  image: string
  imageName?: string | null
  title?: string
  onClose: () => void
}

export function ScanModal({ image, imageName, title, onClose }: ScanModalProps) {
  const [isInverted, setIsInverted] = useState(false)
  const [zoom, setZoom] = useState(1)

  const handleOpenInNewTab = () => {
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${imageName || 'Scan Alone View'}</title>
            <style>
              body {
                margin: 0;
                background: #090d16;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                font-family: sans-serif;
              }
              img {
                max-width: 95vw;
                max-height: 95vh;
                object-fit: contain;
                box-shadow: 0 10px 40px rgba(0,0,0,0.8);
                border-radius: 8px;
              }
            </style>
          </head>
          <body>
            <img src="${image}" alt="Radiology Scan" />
          </body>
        </html>
      `)
      win.document.close()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-white gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🩻</span>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                {title || 'Radiology Scan Viewer'}
              </h3>
              <span className="text-[11px] text-slate-400 truncate block">
                {imageName || 'Original Study Scan'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsInverted(!isInverted)}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer border transition-colors ${
                isInverted
                  ? 'bg-amber-400 text-slate-950 border-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {isInverted ? 'Normal' : 'Invert (Film)'}
            </button>

            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title="Zoom out"
            >
              -
            </button>
            <span className="text-[11px] text-slate-400 w-8 text-center font-mono select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title="Zoom in"
            >
              +
            </button>

            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium cursor-pointer"
              title="Open full resolution in a new tab"
            >
              ↗ New Tab
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl leading-none px-2 cursor-pointer ml-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Viewport Canvas */}
        <div className="flex-1 bg-black flex items-center justify-center p-3 overflow-auto min-h-[300px] max-h-[75vh]">
          <img
            src={image}
            alt={imageName || 'Scan alone'}
            className="max-h-[70vh] max-w-full object-contain transition-transform duration-150 select-none"
            style={{
              transform: `scale(${zoom})`,
              filter: isInverted ? 'invert(1) hue-rotate(180deg)' : 'none',
            }}
          />
        </div>

        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Viewing scan alone • Independent of diagnostic text report</span>
          <span className="sm:hidden">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="text-indigo-400 hover:underline cursor-pointer"
            >
              Open in New Tab
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
