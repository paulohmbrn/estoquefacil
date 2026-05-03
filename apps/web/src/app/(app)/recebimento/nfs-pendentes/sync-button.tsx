'use client';

import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { dispatchSefazSync } from '@/app/_actions/sefaz';

export function SefazSyncButton(): ReactElement {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = (): void => {
    setMsg(null);
    start(async () => {
      const res = await dispatchSefazSync();
      if (res.ok) {
        setMsg('Enfileirado. Atualizando em ~30s…');
        setTimeout(() => router.refresh(), 30_000);
      } else {
        setMsg(`Erro: ${res.error}`);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={onClick} disabled={pending} variant="primary" size="sm">
        {pending ? 'Enfileirando…' : 'Sincronizar agora'}
      </Button>
      {msg && <span className="text-[11px] text-rm-mid">{msg}</span>}
    </div>
  );
}
