import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { statusTone, toneClasses } from "@/lib/status";

export function StatusBadge({ status, label, className = "" }: { status: string; label?: string; className?: string }) {
  return (
    <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses[statusTone(status)]} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label ?? status}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-cb-panel2" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
      <div className="h-full rounded-full bg-gradient-to-r from-cb-amber to-amber-300 transition-[width] duration-700" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="mono-label">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-cb-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-cb-line px-6 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-cb-panel2 text-cb-amber"><Icon size={20} aria-hidden /></div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-cb-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note?: string }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-cb-panel2 p-2.5 text-cb-amber"><Icon size={18} aria-hidden /></div>
        <div className="text-sm text-cb-muted">{label}</div>
      </div>
      <div className="mt-4 truncate text-2xl font-bold tracking-tight">{value}</div>
      {note && <div className="mt-1.5 truncate text-xs text-cb-muted">{note}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl border border-cb-line bg-cb-panel ${className}`} aria-hidden />;
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200" role="status">{children}</div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-cb-muted">{hint}</span>}
    </label>
  );
}

export function Modal({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className={`panel mx-auto my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} p-6`}>
        {eyebrow && <div className="mono-label">{eyebrow}</div>}
        <h2 className="mt-1 text-xl font-bold">{title}</h2>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
