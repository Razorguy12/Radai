import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AppHeader } from '../components/AppHeader'
import { LoadingOverlay } from '../components/LoadingOverlay'
import { generateReport, getTemplates } from '../api/reports'
import type { ReportInputParams, StudyTemplate } from '../types'
import { ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { AudioPdfControls } from '../components/AudioPdfControls'

const STEPS = ['Patient', 'Study', 'Clinical', 'Findings'] as const

const LOADING_MESSAGES = [
  'Analyzing study parameters...',
  'Synthesizing anatomical findings...',
  'Drafting clinical impression...',
  'Formatting structured report...',
]

interface WizardState {
  patientName: string
  patientId: string
  ageSex: string
  modality: string
  studyType: string
  studyDate: string
  scanImage: string | null
  scanImageName: string | null
  clinicalInfo: string
  radiologistFindings: string
}

const defaultState: WizardState = {
  patientName: '',
  patientId: '',
  ageSex: '',
  modality: '',
  studyType: '',
  studyDate: new Date().toISOString().split('T')[0],
  scanImage: null,
  scanImageName: null,
  clinicalInfo: '',
  radiologistFindings: '',
}

function buildParams(state: WizardState): ReportInputParams {
  const patient_info = `${state.patientName}, ${state.ageSex}, ID: ${state.patientId}`.trim()
  const study_info = `${state.modality} ${state.studyType}, ${state.studyDate}`.trim()
  return {
    patient_info,
    study_info,
    clinical_info: state.clinicalInfo || undefined,
    radiologist_findings: state.radiologistFindings || undefined,
    scan_image: state.scanImage || undefined,
    scan_image_name: state.scanImageName || undefined,
  }
}

function applyTemplate(state: WizardState, template: StudyTemplate): WizardState {
  return {
    ...state,
    modality: template.modality,
    studyType: template.study_type,
    clinicalInfo: template.clinical_info || state.clinicalInfo,
  }
}

export default function GeneratePage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(defaultState)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', token],
    queryFn: getTemplates,
    enabled: !!token,
  })

  useEffect(() => {
    const params = (location.state as { regenerateParams?: ReportInputParams })?.regenerateParams
    if (params) {
      setState((s) => ({
        ...s,
        clinicalInfo: params.clinical_info || '',
        radiologistFindings: params.radiologist_findings || '',
        scanImage: params.scan_image || null,
        scanImageName: params.scan_image_name || null,
      }))
    }
  }, [location.state])

  useEffect(() => {
    if (!loading) return
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length
      setLoadingMsg(LOADING_MESSAGES[i])
    }, 2500)
    return () => clearInterval(interval)
  }, [loading])

  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }))

  const canNext = () => {
    if (step === 0) return Boolean(state.patientName.trim() && state.patientId.trim())
    if (step === 1) return Boolean(state.modality.trim() && state.studyType.trim())
    return true
  }

  const handleScanImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      update({ scanImage: event.target?.result as string, scanImageName: file.name })
      toast.success(`Attached scan: ${file.name}`)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const params = buildParams(state)
      const result = await generateReport(params)
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Report generated successfully!')
      navigate(`/reports/${result.id}`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Generation failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      {loading && <LoadingOverlay message="Generating Report" submessage={loadingMsg} />}

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass-panel p-4 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-primary-dark mb-2">New Study Report</h2>
          <p className="text-sm text-slate-600 mb-6">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

          {/* Progress bar */}
          <div className="flex gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Patient Name *</label>
                <input className="form-control" value={state.patientName} onChange={(e) => update({ patientName: e.target.value })} placeholder="John Doe" />
              </div>
              <div>
                <label className="form-label">Patient ID *</label>
                <input className="form-control" value={state.patientId} onChange={(e) => update({ patientId: e.target.value })} placeholder="123456" />
              </div>
              <div>
                <label className="form-label">Age / Sex</label>
                <input className="form-control" value={state.ageSex} onChange={(e) => update({ ageSex: e.target.value })} placeholder="45yo Male" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {templates.length > 0 && (
                <div>
                  <label className="form-label">Quick Template</label>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => update(applyTemplate(state, t))}
                        className="px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Modality *</label>
                <select className="form-control" value={state.modality} onChange={(e) => update({ modality: e.target.value })}>
                  <option value="">Select modality</option>
                  <option value="CT">CT</option>
                  <option value="MRI">MRI</option>
                  <option value="X-ray">X-ray</option>
                  <option value="Ultrasound">Ultrasound</option>
                  <option value="PET">PET</option>
                  <option value="Mammography">Mammography</option>
                </select>
              </div>
              <div>
                <label className="form-label">Study Type *</label>
                <input className="form-control" value={state.studyType} onChange={(e) => update({ studyType: e.target.value })} placeholder="Chest w/ Contrast" />
              </div>
              <div>
                <label className="form-label">Study Date</label>
                <input type="date" className="form-control" value={state.studyDate} onChange={(e) => update({ studyDate: e.target.value })} />
              </div>

              {/* Optional Scan Result Image Upload */}
              <div className="pt-2">
                <label className="form-label">Attach Scan Result Image (Optional)</label>
                {!state.scanImage ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="btn btn-secondary text-sm py-2 px-4 cursor-pointer">
                      📁 Upload Scan Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleScanImageUpload}
                      />
                    </label>
                    <span className="text-xs text-slate-500">CT, MRI, X-ray (PNG, JPG, WebP)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <img
                      src={state.scanImage}
                      alt="Scan preview"
                      className="w-12 h-12 object-cover rounded border border-slate-300 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {state.scanImageName || 'scan_image'}
                      </div>
                      <div className="text-[11px] text-emerald-600">✓ Attached for standalone scan viewing</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => update({ scanImage: null, scanImageName: null })}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <AudioPdfControls
                label="Clinical History / Indication"
                value={state.clinicalInfo}
                onUpdate={(newVal) => update({ clinicalInfo: newVal })}
              />
              <textarea
                className="form-control min-h-[120px]"
                value={state.clinicalInfo}
                onChange={(e) => update({ clinicalInfo: e.target.value })}
                placeholder="e.g., Right lower quadrant pain, rule out appendicitis (or click Voice Dictate / Upload PDF above)"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <AudioPdfControls
                  label="Radiologist Findings (Optional)"
                  value={state.radiologistFindings}
                  onUpdate={(newVal) => update({ radiologistFindings: newVal })}
                />
                <textarea
                  className="form-control min-h-[120px]"
                  value={state.radiologistFindings}
                  onChange={(e) => update({ radiologistFindings: e.target.value })}
                  placeholder="e.g., 5mm nodule in right upper lobe (or click Voice Dictate / Upload PDF above)"
                />
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                <strong className="text-primary-dark">Review summary:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>{state.patientName} (ID: {state.patientId})</li>
                  <li>{state.modality} — {state.studyType}</li>
                  <li>Date: {state.studyDate}</li>
                  {state.scanImage && <li>Scan image: {state.scanImageName || 'Attached'}</li>}
                </ul>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => step === 0 ? navigate('/dashboard') : setStep(step - 1)}
              className="btn btn-secondary"
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!canNext()}
                onClick={() => setStep(step + 1)}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} className="btn btn-primary">
                Generate Report
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
