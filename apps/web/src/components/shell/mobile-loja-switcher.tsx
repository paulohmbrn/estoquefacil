'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { setLojaAtiva } from '@/app/_actions/loja-ativa';
import type { LojaSwitcherItem } from './loja-switcher';

interface Props {
  lojas: LojaSwitcherItem[];
  ativaId: string | null;
  apelidoLoja: string | null;
}

export function MobileLojaSwitcher({ lojas, ativaId, apelidoLoja }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const podeTrocar = lojas.length > 1;

  function escolher(lojaId: string) {
    if (lojaId === ativaId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setLojaAtiva(lojaId);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={!podeTrocar}
        onClick={() => setOpen(true)}
        className={
          podeTrocar
            ? 'flex items-center gap-1 text-[9px] tracking-[.22em] uppercase text-rm-mid font-semibold mt-[2px] truncate hover:text-rm-green transition-colors -ml-[2px] active:opacity-60'
            : 'flex items-center gap-1 text-[9px] tracking-[.22em] uppercase text-rm-mid font-semibold mt-[2px] truncate'
        }
      >
        <span className="truncate">RM · {apelidoLoja ?? '—'}</span>
        {podeTrocar && <ChevronDown size={10} strokeWidth={2.5} />}
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-[rgba(10,26,16,.55)] flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[520px] bg-white rounded-t-xs border-t-[6px] border-rm-green max-h-[80vh] overflow-auto overscroll-contain"
            // 88px = altura aproximada do MobileBottomNav (~56px + folga); +safe-area pra notch
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-hairline flex items-center justify-between">
              <div>
                <p className="rm-eyebrow text-rm-green">Trocar de loja</p>
                <p className="text-[12px] text-rm-mid mt-1">
                  {lojas.length} {lojas.length === 1 ? 'loja vinculada' : 'lojas vinculadas'}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-rm-mid text-2xl leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <ul className="divide-y divide-hairline">
              {lojas.map((l) => {
                const ativa = l.id === ativaId;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => escolher(l.id)}
                      className={
                        ativa
                          ? 'w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-[rgba(0,65,37,.06)]'
                          : 'w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[rgba(0,65,37,.04)] disabled:opacity-50'
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className={ativa ? 'font-semibold text-rm-green truncate' : 'font-medium text-rm-ink truncate'}>
                          {l.apelido ?? l.nome}
                        </p>
                        <p className="text-[10px] tracking-[.18em] uppercase text-rm-mid mt-1">
                          #{l.zmartbiId} · {l.papel === 'GESTOR' ? 'Gestor' : 'Operador'}
                        </p>
                      </div>
                      {ativa && <Check size={18} className="text-rm-green shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
