import { useEffect } from 'react';

/**
 * Accessible modal.
 *
 * WHY the Escape listener and the body scroll lock: without them a modal
 * traps the user (no keyboard way out) and the page behind it scrolls under
 * the overlay, which looks broken on a laptop trackpad.
 */
export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Restore the ORIGINAL overflow value, not a hardcoded 'auto' - otherwise
    // closing a modal would quietly change the page's own scroll behaviour.
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      // Click the backdrop to dismiss, but only the backdrop itself - the
      // currentTarget check stops a click inside the panel bubbling up and
      // closing the dialog mid-typing.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card w-full max-w-lg p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
            &#10005;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
