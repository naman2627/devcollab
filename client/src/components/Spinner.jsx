/** Inline spinner, sized by its parent's font size. */
export default function Spinner({ className = '' }) {
  return (
    <span
      // role=status + sr-only text: a bare spinning div is invisible to a
      // screen reader, so the user is told nothing is happening.
      role="status"
      aria-label="Loading"
      className={`inline-block size-4 animate-spin rounded-full border-2 border-slate-600 border-t-brand ${className}`}
    />
  );
}

/** Full-height spinner for a route that is still fetching or lazy-loading. */
export function PageSpinner({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="size-7 border-[3px]" />
      <p className="text-sm">{label}...</p>
    </div>
  );
}
