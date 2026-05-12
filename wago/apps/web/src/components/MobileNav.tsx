import { useState } from 'react';

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="sm:hidden rounded-lg p-2 text-text-tertiary hover:text-text-primary transition-colors"
        aria-label="Menu"
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        )}
      </button>

      {open && (
        <div className="border-t border-border-primary bg-bg-secondary/95 backdrop-blur-xl px-6 py-5 space-y-1 sm:hidden">
          <a href="/login" onClick={() => setOpen(false)} className="block rounded-lg bg-wa-green px-4 py-2.5 text-center text-sm font-semibold text-text-inverse hover:bg-wa-green-dark transition-colors">
            Iniciar sesión
          </a>
        </div>
      )}
    </>
  );
}
