import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";

export const dynamic = 'force-dynamic';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard><AppShell>{children}</AppShell></AuthGuard>;
}
