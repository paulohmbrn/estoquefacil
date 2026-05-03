'use server';

import { revalidatePath } from 'next/cache';
import { requireGestor } from '@/lib/permissions';
import { zmartbiQueue } from '@/lib/queue';

export type DispatchResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string };

export async function dispatchZmartbiSync(): Promise<DispatchResult> {
  try {
    const user = await requireGestor();
    const job = await zmartbiQueue.add(
      'zmartbi-sync-manual',
      { kind: 'manual', userId: user.id },
      {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
        // Defesa contra duplo clique: dedupe pelo nome do job nos próximos 60s.
        deduplication: { id: `manual-${user.id}`, ttl: 60_000 },
      },
    );
    revalidatePath('/sincronizacao');
    return { ok: true, jobId: String(job.id) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
