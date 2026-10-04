import { useState } from 'react'
import type { ReportSummary } from '../types'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ScanModal } from './ScanModal'

interface ReportCardProps {
  report: ReportSummary
}

export function ReportCard({ report }: ReportCardProps) {
  const date = new Date(report.created_at).toLocaleDateString()
  const [showScanModal, setShowScanModal] = useState(false)
  const scanImg = report.scan_image || report.report_data?.scan_image
  const scanImgName = report.scan_image_name || report.report_data?.scan_image_name

  return (
    <>
      {showScanModal && scanImg && (
        <ScanModal
          image={scanImg}
          imageName={scanImgName}
          title={`${report.patient_name} — ${report.modality} Scan`}
          onClose={() => setShowScanModal(false)}
        />
      )}

      <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
        <div className="glass-panel p-5 border-l-4 border-l-primary flex flex-col justify-between hover:shadow-lg transition-all h-full bg-white/90">
          <div>
            <div className="flex justify-between items-start gap-2 mb-2">
              <Link
                to={`/reports/${report.id}`}
                className="text-base sm:text-lg font-semibold text-primary-dark no-underline hover:underline truncate"
              >
                {report.patient_name}
              </Link>
              <span className={report.status === 'final' ? 'badge-final shrink-0' : 'badge-draft shrink-0'}>
                {report.status}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-slate-500 mb-3">
              ID: <strong>{report.patient_id}</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                {report.modality}
              </span>
              <span className="text-slate-500">{date}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {scanImg && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowScanModal(true)
                  }}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-primary/10 text-slate-700 hover:text-primary border border-slate-200 font-medium text-xs cursor-pointer flex items-center gap-1"
                  title="View scan image alone"
                >
                  🩻 View Scan
                </button>
              )}
              <Link
                to={`/reports/${report.id}`}
                className="px-2.5 py-1 rounded bg-primary text-white font-medium text-xs no-underline hover:bg-primary-light"
              >
                Open →
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
