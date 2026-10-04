import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { extractTextFromPdf, transcribeAudio } from '../api/reports'
import { ApiError } from '../api/client'

interface AudioPdfControlsProps {
  label: string
  value: string
  onUpdate: (newValue: string) => void
}

// Helper to obtain audio stream with multiple fallbacks if default device is disconnected
async function getAudioStream(): Promise<MediaStream> {
  // Strategy 1: Standard audio constraint
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (err: unknown) {
    const error = err as { name?: string }
    if (error.name !== 'NotFoundError' && error.name !== 'DevicesNotFoundError') {
      throw err
    }
  }

  // Strategy 2: Enumerate devices and try available audioinput deviceIds
  if (navigator.mediaDevices.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter((d) => d.kind === 'audioinput')
      for (const dev of audioInputs) {
        if (dev.deviceId) {
          try {
            return await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: dev.deviceId } },
            })
          } catch {
            // try next
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Strategy 3: Try deviceId 'default' with no advanced constraints
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: 'default' },
    })
  } catch {
    const notFound = new Error('NotFoundError')
    notFound.name = 'NotFoundError'
    throw notFound
  }
}

export function AudioPdfControls({ label, value, onUpdate }: AudioPdfControlsProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isExtractingPdf, setIsExtractingPdf] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [micPermission, setMicPermission] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown')
  const [hasNotFoundError, setHasNotFoundError] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  // Check microphone permission state on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          setMicPermission(permissionStatus.state as 'granted' | 'prompt' | 'denied')
          permissionStatus.onchange = () => {
            setMicPermission(permissionStatus.state as 'granted' | 'prompt' | 'denied')
          }
        })
        .catch(() => {
          setMicPermission('unknown')
        })
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Explicitly prompt the browser for microphone permission
  const requestMicPermission = async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Microphone requires a secure connection (HTTPS or localhost).')
      return false
    }

    setHasNotFoundError(false)
    try {
      const stream = await getAudioStream()
      stream.getTracks().forEach((track) => track.stop())
      setMicPermission('granted')
      toast.success('Microphone permission granted!')
      return true
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string }
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicPermission('denied')
        toast.error(
          'Microphone permission was denied. Please click the lock icon in your address bar and set Microphone to "Allow".',
          { duration: 6000 }
        )
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setHasNotFoundError(true)
        toast.error(
          'No active microphone detected. If your headset is disconnected, check brave://settings/content/microphone and select "Default" or "Built-in Audio", or use "🎧 Audio File" below.',
          { duration: 8000 }
        )
      } else {
        toast.error(`Microphone error: ${error.name || error.message || 'Unknown error'}`)
      }
      return false
    }
  }

  // Toggle Voice Dictation via MediaRecorder + Groq Whisper
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording()
      return
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Microphone access requires HTTPS or localhost. Please access via the secure link.')
      return
    }

    setHasNotFoundError(false)
    try {
      const stream = await getAudioStream()
      setMicPermission('granted')

      // Determine optimal audio mimeType supported by the browser
      let mimeType = ''
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        })

        if (audioBlob.size === 0) {
          toast.error('No audio recorded.')
          return
        }

        setIsTranscribing(true)
        const toastId = toast.loading('Transcribing voice note with AI...')
        try {
          const res = await transcribeAudio(audioBlob, 'dictation.webm')
          if (res.text && res.text.trim()) {
            const newText = value.trim() ? `${value.trim()} ${res.text.trim()}` : res.text.trim()
            onUpdate(newText)
            toast.success('Voice dictation transcribed!', { id: toastId })
          } else {
            toast('No clear speech detected.', { id: toastId, icon: 'ℹ️' })
          }
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Transcription failed', { id: toastId })
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start(500)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1)
      }, 1000)

      toast('🎙️ Recording... Speak your findings. Click Stop when done.', { icon: '🎙️' })
    } catch (err: unknown) {
      console.error('Microphone error:', err)
      const error = err as { name?: string }
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicPermission('denied')
        toast.error(
          'Microphone permission blocked. Click the lock/settings icon in your browser address bar and set Microphone to "Allow".',
          { duration: 6000 }
        )
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setHasNotFoundError(true)
        toast.error(
          'No microphone found. Please connect a microphone or select "Default" in brave://settings/content/microphone. You can also upload audio with "🎧 Audio File".',
          { duration: 8000 }
        )
      } else {
        toast.error('Could not access microphone. Please check your browser audio settings.')
      }
    }
  }

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    setIsRecording(false)
  }

  // Handle PDF text extraction
  const handlePdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setIsExtractingPdf(true)
    const toastId = toast.loading(`Extracting text from ${file.name}...`)
    try {
      const res = await extractTextFromPdf(file)
      if (res.text && res.text.trim()) {
        const textToInsert = res.text.trim()
        const newText = value.trim()
          ? `${value.trim()}\n\n[Imported from ${res.filename}]:\n${textToInsert}`
          : textToInsert
        onUpdate(newText)
        toast.success(`Extracted text from ${res.filename} (${res.page_count} page(s))`, { id: toastId })
      } else {
        toast.error('No readable text found in this PDF.', { id: toastId })
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'PDF extraction failed', { id: toastId })
    } finally {
      setIsExtractingPdf(false)
    }
  }

  // Handle audio file upload
  const handleAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setIsTranscribing(true)
    const toastId = toast.loading(`Transcribing ${file.name}...`)
    try {
      const res = await transcribeAudio(file, file.name)
      if (res.text && res.text.trim()) {
        const newText = value.trim() ? `${value.trim()}\n\n${res.text.trim()}` : res.text.trim()
        onUpdate(newText)
        toast.success(`Transcribed ${file.name}`, { id: toastId })
      } else {
        toast('No speech detected in audio file.', { id: toastId, icon: 'ℹ️' })
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Transcription failed', { id: toastId })
    } finally {
      setIsTranscribing(false)
    }
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div>
      <input
        type="file"
        ref={pdfInputRef}
        accept=".pdf"
        className="hidden"
        onChange={handlePdfFile}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
        className="hidden"
        onChange={handleAudioFile}
      />

      {/* Permission prompt banner if permission is not yet given */}
      {micPermission === 'prompt' && (
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2 mb-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900">
          <span>🎙️ Browser microphone permission is not yet granted.</span>
          <button
            type="button"
            onClick={requestMicPermission}
            className="px-2.5 py-1 font-semibold bg-primary text-white rounded cursor-pointer hover:bg-primary-light shrink-0"
          >
            Enable Microphone
          </button>
        </div>
      )}

      {/* Warning banner if microphone permission is blocked */}
      {micPermission === 'denied' && (
        <div className="p-2 mb-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
          ⚠️ <strong>Microphone blocked:</strong> Click the lock icon 🔒 next to the website address in your browser URL bar and set <strong>Microphone</strong> to <strong>Allow</strong>.
        </div>
      )}

      {/* Guidance banner if NotFoundError occurs */}
      {hasNotFoundError && (
        <div className="p-2.5 mb-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
          <div className="font-semibold flex items-center gap-1">
            <span>⚠️</span> No active microphone input detected:
          </div>
          <div className="text-[11px] text-amber-800">
            • If you have an unplugged headset (e.g. Bluetooth), open <code>brave://settings/content/microphone</code> in a new tab and select <strong>Default</strong> or your <strong>Built-in Audio</strong> input device.
          </div>
          <div className="text-[11px] text-amber-800">
            • You can also upload any audio recording or voice memo using the <strong>🎧 Audio File</strong> button below!
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <label className="form-label m-0">{label}</label>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Status badge */}
          {micPermission === 'granted' && (
            <span className="text-[11px] text-emerald-600 font-medium mr-1">
              ✓ Mic allowed
            </span>
          )}

          {/* Voice Dictate Button */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isTranscribing || isExtractingPdf}
            className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all border ${
              isRecording
                ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
            }`}
          >
            {isRecording ? `🔴 Stop (${formatTimer(recordingSeconds)})` : isTranscribing ? '⏳ Transcribing...' : '🎙️ Voice Dictate'}
          </button>

          {/* Upload PDF Button */}
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={isRecording || isExtractingPdf}
            className="px-2.5 py-1 rounded-md font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer disabled:opacity-50"
          >
            {isExtractingPdf ? '⏳ Reading PDF...' : '📄 Upload PDF'}
          </button>

          {/* Upload Audio Button */}
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            disabled={isRecording || isTranscribing}
            className="px-2.5 py-1 rounded-md font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer disabled:opacity-50"
            title="Upload audio recording file"
          >
            🎧 Audio File
          </button>
        </div>
      </div>
    </div>
  )
}
