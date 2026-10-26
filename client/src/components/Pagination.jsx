/**
 * Pagination bar driven entirely by the server's envelope
 * ({page, totalPages, hasMore}) rather than by any local guess at the count.
 */
export default function Pagination({ page, totalPages, total, onChange }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
      <button
        className="btn-ghost"
        // Clamped here as well as on the server: a disabled button still
        // prevents the request, which keeps the UI honest on fast clicks.
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>

      <span className="text-sm text-slate-500">
        Page <span className="text-slate-300">{page}</span> of {totalPages}
        {typeof total === 'number' && <span className="ml-2 text-slate-600">({total} total)</span>}
      </span>

      <button className="btn-ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}
