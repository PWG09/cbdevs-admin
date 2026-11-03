"use client";

import { useEffect, useState } from "react";

/** Two-step destructive button: first click arms it, second click confirms; disarms after 4s. */
export default function ConfirmButton({ onConfirm, children, confirmLabel = "¿Confirmar?", className = "btn-ghost", disabled, title }: { onConfirm: () => void | Promise<void>; children: React.ReactNode; confirmLabel?: string; className?: string; disabled?: boolean; title?: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`${className} ${armed ? "!border-red-400/60 !text-red-200" : ""}`} disabled={disabled || busy} title={title} aria-label={armed ? confirmLabel : title}
      onClick={async () => {
        if (!armed) { setArmed(true); return; }
        setBusy(true);
        try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
      }}>
      {armed ? confirmLabel : children}
    </button>
  );
}
