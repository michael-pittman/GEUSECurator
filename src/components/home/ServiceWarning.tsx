export function ServiceWarning() {
  return (
    <div className="mx-5 mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-7 w-7 items-center justify-center">
          <span className="absolute inline-flex h-6 w-6 rounded-full bg-amber-300/20 animate-ping" />
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-200/25 text-sm animate-bounce">
            (=^.^=)
          </span>
        </div>
        <p className="text-[11px] leading-tight text-amber-100/95">
          GPUs are expensive. Site function is currently limited. Email{' '}
          <a
            href="mailto:info@geuse.io?subject=Turn%20on%20GPU"
            className="underline decoration-amber-200/70 underline-offset-2 hover:text-amber-50"
          >
            info@geuse.io
          </a>{' '}
          for demo access.
        </p>
      </div>
    </div>
  )
}
