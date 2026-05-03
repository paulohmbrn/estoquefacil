import { AppShell } from '@/components/shell/app-shell';
import { MobileBottomNav } from '@/components/shell/mobile-bottom-nav';
import { InstallPrompt } from '@/app/_components/install-prompt';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <MobileBottomNav />
      <InstallPrompt />
    </>
  );
}
