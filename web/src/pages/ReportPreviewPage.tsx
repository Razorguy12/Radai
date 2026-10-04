import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AppHeader } from '../components/AppHeader'
import { LoadingOverlay } from '../components/LoadingOverlay'
import { ScanModal } from '../components/ScanModal'
import { useAuth } from '../context/AuthContext'
import {
  getReport,
  updateReport,
  updateReportStatus,
  downloadReportPdf,
} from '../api/reports'
import type { RadiologyReport, RadiologyFinding } from '../types'
import { ApiError } from '../api/client'

export default function ReportPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { token } = useAuth()
  const reportId = Number(id)

  const [editedReport, setEditedReport] = useState<RadiologyReport | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', reportId, token],
    queryFn: () => getReport(reportId),
    enabled: !!reportId && !!token,
  })

  useEffect(() => {
    if (data?.report_data) {
      const rep = structuredClone(data.report_data)
      if (data.scan_image && !rep.scan_image) {
        rep.scan_image = data.scan_image
        rep.scan_image_name = data.scan_image_name
      }
      setEditedReport(rep)
      setIsDirty(false)
      setIsEditMode(false)
    }
  }, [data])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const report = editedReport

  const updateField = useCallback((field: keyof RadiologyReport, value: string) => {
    setEditedReport((prev) => (prev ? { ...prev, [field]: value } : prev))
    setIsDirty(true)
  }, [])

  const updateFinding = useCallback((index: number, field: keyof RadiologyFinding, value: string) => {
    setEditedReport((prev) => {
      if (!prev) return prev
      const findings = [...prev.findings]
      findings[index] = { ...findings[index], [field]: value }
      return { ...prev, findings }
    })
    setIsDirty(true)
  }, [])

  const updateRecommendation = useCallback((index: number, value: string) => {
    setEditedReport((prev) => {
      if (!prev) return prev
      const recs = [...(prev.recommendations || [])]
      recs[index] = value
      return { ...prev, recommendations: recs }
    })
    setIsDirty(true)
  }, [])

  const handleSave = async () => {
    if (!report) return
    setIsSaving(true)
    try {
      await updateReport(reportId, report)
      await queryClient.invalidateQueries({ queryKey: ['report', reportId] })
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
      setIsDirty(false)
      toast.success('Report saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinalize = async () => {
    if (isDirty) {
      toast.error('Save your changes before finalizing')
      return
    }
    try {
      await updateReportStatus(reportId, 'final')
      await queryClient.invalidateQueries({ queryKey: ['report', reportId] })
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Report marked as final')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to finalize')
    }
  }

  const handleDownload = async () => {
    if (!report) return
    if (isDirty) {
      toast.error('Save your changes before downloading')
      return
    }
    setIsPdfLoading(true)
    try {
      await downloadReportPdf(report)
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF download failed')
    } finally {
      setIsPdfLoading(false)
    }
  }

  const handleRegenerate = () => {
    if (data?.status === 'final') {
      toast.error('Cannot regenerate a finalized report')
      return
    }
    navigate('/generate', { state: { regenerateParams: data?.input_params } })
  }

  if (isLoading || (data && !report)) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <LoadingOverlay message="Loading report..." />
      </div>
    )
  }

  if (error || !data || !report) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="glass-panel p-6 sm:p-8 text-center max-w-md w-full">
            <p className="text-red-500 mb-2 font-medium">Report not found</p>
            <p className="text-slate-600 text-sm mb-4">
              {error instanceof Error ? error.message : 'Unable to load this report.'}
            </p>
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary w-full">
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    )
  }

  const isFinal = data.status === 'final'
  const findings = report.findings ?? []
  const hasScan = Boolean(report.scan_image)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <AppHeader />
      {isPdfLoading && <LoadingOverlay message="Generating PDF..." />}

      {/* Modal to view scan alone */}
      {showScanModal && report.scan_image && (
        <ScanModal
          image={report.scan_image}
          imageName={report.scan_image_name}
          title={`${report.patient_name} — ${report.modality} Study Scan`}
          onClose={() => setShowScanModal(false)}
        />
      )}

      {/* Non-sticky Action Toolbar */}
      <div className="relative w-full px-4 sm:px-6 py-2.5 bg-white/70 border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-secondary text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4"
          >
            ← Dashboard
          </button>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* View Scan Alone Button */}
            {hasScan && (
              <button
                type="button"
                onClick={() => setShowScanModal(true)}
                className="btn btn-secondary text-xs sm:text-sm py-1.5 sm:py-2 px-3 text-primary border-primary/30 font-semibold hover:bg-primary/5 cursor-pointer"
                title="View the medical scan image alone"
              >
                🩻 View Scan Alone
              </button>
            )}

            {!isFinal && (
              <button
                onClick={handleRegenerate}
                className="btn btn-secondary text-xs sm:text-sm py-1.5 sm:py-2 px-3"
              >
                Regenerate
              </button>
            )}
            {!isFinal && (
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="btn btn-secondary text-xs sm:text-sm py-1.5 sm:py-2 px-3"
              >
                {isEditMode ? 'View Mode' : 'Edit Mode'}
              </button>
            )}
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary text-xs sm:text-sm py-1.5 sm:py-2 px-3.5"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            {!isFinal && !isDirty && (
              <button
                onClick={handleFinalize}
                className="btn btn-secondary text-xs sm:text-sm py-1.5 sm:py-2 px-3"
              >
                Mark as Final
              </button>
            )}
            <button
              onClick={handleDownload}
              className="btn btn-primary text-xs sm:text-sm py-1.5 sm:py-2 px-3.5"
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8">
        <div className="glass-panel p-4 sm:p-8 max-w-none">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-slate-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary-dark m-0">RADIOLOGY REPORT</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={isFinal ? 'badge-final' : 'badge-draft'}>{data.status}</span>
                {hasScan && (
                  <button
                    type="button"
                    onClick={() => setShowScanModal(true)}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer bg-primary/5 px-2 py-0.5 rounded border border-primary/20"
                  >
                    🩻 View Scan Alone
                  </button>
                )}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs font-semibold text-slate-500 uppercase">Radiologist</div>
              {isEditMode && !isFinal ? (
                <input
                  className="form-control text-left sm:text-right mt-1 text-sm py-1"
                  value={report.radiologist_name || ''}
                  onChange={(e) => updateField('radiologist_name', e.target.value)}
                />
              ) : (
                <div className="font-medium text-sm mt-0.5">{report.radiologist_name || 'Dr. System'}</div>
              )}
            </div>
          </div>

          {/* Demographics Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {([
              ['Patient Name', report.patient_name, 'patient_name'],
              ['Patient ID', report.patient_id, 'patient_id'],
              ['Study Date', report.study_date, 'study_date'],
              ['Modality', report.modality, 'modality'],
              ['Study Type', report.study_type, 'study_type'],
            ] as const).map(([label, val, field]) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 font-semibold mb-1">{label}</div>
                {isEditMode && !isFinal ? (
                  <input
                    className="form-control text-sm py-1"
                    value={val}
                    onChange={(e) => updateField(field, e.target.value)}
                  />
                ) : (
                  <div className="font-medium text-sm text-slate-900">{val}</div>
                )}
              </div>
            ))}
          </div>

          {/* Findings */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold text-primary-dark mb-4 pb-2 border-b border-slate-200">
              FINDINGS
            </h2>
            <div className="space-y-3 sm:space-y-4">
              {findings.map((finding, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-3 sm:p-4">
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                    {isEditMode && !isFinal ? (
                      <input
                        className="form-control max-w-xs font-semibold text-sm py-1"
                        value={finding.location}
                        onChange={(e) => updateFinding(idx, 'location', e.target.value)}
                      />
                    ) : (
                      <span className="font-semibold text-sm text-slate-900">{finding.location}</span>
                    )}

                    {isEditMode && !isFinal ? (
                      <select
                        className="form-control max-w-[130px] text-xs py-1"
                        value={finding.severity}
                        onChange={(e) => updateFinding(idx, 'severity', e.target.value)}
                      >
                        <option value="mild">mild</option>
                        <option value="moderate">moderate</option>
                        <option value="severe">severe</option>
                      </select>
                    ) : (
                      <span className={`badge-${finding.severity} px-2 py-0.5 rounded-full text-xs font-medium`}>
                        {finding.severity}
                      </span>
                    )}
                  </div>

                  {isEditMode && !isFinal ? (
                    <textarea
                      className="form-control text-sm min-h-[60px]"
                      value={finding.description}
                      onChange={(e) => updateFinding(idx, 'description', e.target.value)}
                    />
                  ) : (
                    <p className="text-slate-700 text-sm m-0 leading-relaxed whitespace-pre-wrap">
                      {finding.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Impression */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold text-primary-dark mb-4 pb-2 border-b border-slate-200">
              IMPRESSION
            </h2>
            {isEditMode && !isFinal ? (
              <textarea
                className="form-control min-h-[80px] text-sm"
                value={report.impression}
                onChange={(e) => updateField('impression', e.target.value)}
              />
            ) : (
              <div className="bg-primary/5 rounded-lg p-3 sm:p-4 font-medium text-slate-800 leading-relaxed text-sm">
                {report.impression}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold text-primary-dark mb-4 pb-2 border-b border-slate-200">
              RECOMMENDATIONS
            </h2>
            {report.recommendations && report.recommendations.length > 0 ? (
              <ul className="space-y-2 pl-0 list-none text-sm">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-700">
                    <span className="text-primary font-bold">•</span>
                    {isEditMode && !isFinal ? (
                      <input
                        className="form-control flex-1 py-1 text-sm"
                        value={rec}
                        onChange={(e) => updateRecommendation(idx, e.target.value)}
                      />
                    ) : (
                      <span>{rec}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm italic">None</p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 sm:pt-6 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
            <span>Report #{reportId}</span>
            <span>Created {new Date(data.created_at).toLocaleString()}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
