interface LoadingOverlayProps {
  message?: string
  submessage?: string
}

export function LoadingOverlay({ message = 'Loading...', submessage }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
      <div className="spinner" />
      <h3 className="text-primary-dark font-semibold text-lg">{message}</h3>
      {submessage && <p className="text-primary font-medium">{submessage}</p>}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="glass-panel p-6 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
      <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
      <div className="h-4 bg-slate-200 rounded w-full" />
    </div>
  )
}
