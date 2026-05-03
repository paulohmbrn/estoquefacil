'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { dispatchZmartbiSync } from '@/app/_actions/sync';

interface Props {
  isGestor: boolean;
  isRunning: boolean;
}

export function SyncButton({ isGestor, isRunning }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  if (!isGestor) {
    return (
      <p className="rm-caption text-rm-mid">
        Apenas Gestor pode disparar o sync manualmente.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        variant="primary"
        size="lg"
        disabled={pending || isRunning}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const r = await dispatchZmartbiSync();
            if (r.ok) {
              setMsg(`Job ${r.jobId} enfileirado. O sync começa em poucos segundos…`);
              setTimeout(() => router.refresh(), 4000);
            } else {
              setMsg(`Erro: ${r.error}`);
            }
          })
        }
      >
        {isRunning ? 'Sincronização em andamento…' : pending ? 'Enfileirando…' : 'Sincronizar agora'}
      </Button>
      {msg && <p className="rm-caption text-rm-ink-2">{msg}</p>}
    </div>
  );
}
