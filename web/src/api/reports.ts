import { apiFetch, apiFetchBlob } from './client'
import type {
  AdminUser,
  DashboardStats,
  GenerateReportResponse,
  RadiologyReport,
  ReportInputParams,
  ReportSummary,
  StudyTemplate,
  UserProfile,
  LoginResponse,
  PdfExtractionResponse,
  AudioTranscriptionResponse,
} from '../types'

export async function extractTextFromPdf(file: File): Promise<PdfExtractionResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<PdfExtractionResponse>('/api/extract-text-from-pdf', {
    method: 'POST',
    body: formData,
  })
}

export async function transcribeAudio(file: Blob | File, filename = 'dictation.webm'): Promise<AudioTranscriptionResponse> {
  const formData = new FormData()
  formData.append('file', file, filename)
  return apiFetch<AudioTranscriptionResponse>('/api/transcribe-audio', {
    method: 'POST',
    body: formData,
  })
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const formData = new URLSearchParams()
  formData.append('username', username)
  formData.append('password', password)

  return apiFetch<LoginResponse>('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  })
}

export async function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/users/me')
}

export async function getReports(): Promise<ReportSummary[]> {
  return apiFetch<ReportSummary[]>('/api/reports')
}

export async function getReport(id: number): Promise<ReportSummary> {
  return apiFetch<ReportSummary>(`/api/reports/${id}`)
}

export async function updateReport(
  id: number,
  reportData: RadiologyReport,
): Promise<ReportSummary> {
  return apiFetch<ReportSummary>(`/api/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ report_data: reportData }),
  })
}

export async function updateReportStatus(
  id: number,
  status: 'draft' | 'final',
): Promise<ReportSummary> {
  return apiFetch<ReportSummary>(`/api/reports/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function generateReport(
  params: ReportInputParams,
): Promise<GenerateReportResponse> {
  return apiFetch<GenerateReportResponse>('/api/generate-report', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function downloadReportPdf(report: RadiologyReport): Promise<void> {
  const blob = await apiFetchBlob('/api/create-pdf-from-report', {
    method: 'POST',
    body: JSON.stringify(report),
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `radiology_report_${report.patient_id}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/api/dashboard/stats')
}

export async function getTemplates(): Promise<StudyTemplate[]> {
  return apiFetch<StudyTemplate[]>('/api/templates')
}

export async function getUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/api/users')
}

export async function createUser(data: {
  name: string
  username: string
  email: string
  password: string
  is_admin: boolean
}): Promise<{ msg: string }> {
  return apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getUserReports(userId: number): Promise<ReportSummary[]> {
  return apiFetch<ReportSummary[]>(`/api/admin/users/${userId}/reports`)
}
