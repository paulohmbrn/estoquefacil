'use client';

// Fluxo imersivo (tablet): bipa seriais das etiquetas que estão saindo,
// acumula a lista, escolhe setor + responsável e confirma a baixa.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QrScanner } from '../../contagem/[id]/qr-scanner';
import { baixarEtiquetas } from '@/app/_actions/estoque-controlado';

type Func = { id: string; nome: string };
type Flash = { tipo: 'novo' | 'dup'; serial: string; key: number };

export function BaixaClient({ funcionarios }: { funcionarios: Func[] }) {
  const [seriais, setSeriais] = useState<string[]>([]);
  const [setor, setSetor] = useState('');
  const [respId, setRespId] = useState<string | null>(null);
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Espelho do estado pra detectar duplicado mesmo em scans rápidos (closure).
  const seriaisRef = useRef<string[]>([]);
  useEffect(() => {
    seriaisRef.current = seriais;
  }, [seriais]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  function onScan(text: string) {
    const serial = text.trim().toUpperCase();
    if (!serial) return;
    const dup = seriaisRef.current.includes(serial);
    if (!dup) setSeriais((prev) => (prev.includes(serial) ? prev : [...prev, serial]));

    // Feedback bem visível: overlay grande + vibração (haptic no tablet).
    setFlash({ tipo: dup ? 'dup' : 'novo', serial, key: Date.now() });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(dup ? [30, 40, 30] : 70);
    }
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1100);
  }

  function remover(s: string) {
    setSeriais((prev) => prev.filter((x) => x !== s));
  }

  function confirmar() {
    if (seriais.length === 0 || !setor.trim()) return;
    setMsg(null);
    startTransition(async () => {
      const r = await baixarEtiquetas({
        seriais,
        setorSolicitante: setor.trim(),
        responsavelId: respId ?? undefined,
        obs: obs.trim() || undefined,
      });
      if (r.ok && r.data) {
        setMsg({
          tipo: 'ok',
          texto: `${r.data.baixadas} baixada(s)${
            r.data.ignoradas ? `, ${r.data.ignoradas} ignorada(s) (não estavam ativas)` : ''
          }.`,
        });
        setSeriais([]);
        setObs('');
        router.refresh();
      } else if (!r.ok) {
        setMsg({ tipo: 'erro', texto: r.error });
      }
    });
  }

  return (
    <div className="max-w-[920px] mx-auto pb-28">
      <div className="mb-4">
        <p className="rm-eyebrow text-rm-gold">Estoque Controlado · Baixa</p>
        <h1 className="rm-h3 mt-1">
          Bipe as <em>etiquetas</em> que estão saindo
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="relative aspect-square bg-black rounded-xs overflow-hidden">
            <QrScanner onScan={onScan} pause={pending} />
            {flash && (
              <div
                key={flash.key}
                className={`absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-200 ${
                  flash.tipo === 'novo'
                    ? 'bg-[rgba(0,65,37,.88)] text-white'
                    : 'bg-[rgba(184,144,46,.92)] text-rm-ink'
                }`}
              >
                {flash.tipo === 'novo' ? (
                  <CheckCircle2 size={96} strokeWidth={2.4} />
                ) : (
                  <Copy size={84} strokeWidth={2.4} />
                )}
                <p className="mt-3 text-[28px] font-bold tracking-wide">
                  {flash.tipo === 'novo' ? 'BIPADO!' : 'JÁ NA LISTA'}
                </p>
                <p className="mt-1 font-mono text-[16px] opacity-90">{flash.serial}</p>
                <p className="mt-2 text-[14px] opacity-90">
                  {flash.tipo === 'novo'
                    ? `Total bipado: ${seriais.length}`
                    : 'Essa etiqueta já foi bipada'}
                </p>
              </div>
            )}
          </div>
          <p className="text-[12px] text-rm-mid mt-2">
            Cada etiqueta tem um QR único. Bipe uma por uma — duplicados são ignorados.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="rm-eyebrow text-rm-mid block mb-1">
              Setor solicitante *
            </label>
            <input
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="ex: copa, cozinha, salão"
              className="w-full border border-hairline rounded-xs px-3 py-2 text-[14px]"
            />
          </div>

          <div>
            <label className="rm-eyebrow text-rm-mid block mb-1">Responsável</label>
            <select
              value={respId ?? ''}
              onChange={(e) => setRespId(e.target.value || null)}
              className="w-full border border-hairline rounded-xs px-3 py-2 text-[14px]"
            >
              <option value="">— sem responsável —</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rm-eyebrow text-rm-mid block mb-1">Observação</label>
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="w-full border border-hairline rounded-xs px-3 py-2 text-[14px]"
            />
          </div>

          <div>
            <p className="rm-eyebrow text-rm-mid mb-2">
              Etiquetas bipadas: <strong className="text-rm-ink">{seriais.length}</strong>
            </p>
            <div className="max-h-[200px] overflow-auto border border-hairline rounded-xs divide-y">
              {seriais.length === 0 ? (
                <p className="px-3 py-3 text-[13px] text-rm-mid">Nenhuma ainda.</p>
              ) : (
                seriais.map((s) => (
                  <div
                    key={s}
                    className="flex items-center justify-between px-3 py-2 text-[13px]"
                  >
                    <span className="font-mono">{s}</span>
                    <button
                      type="button"
                      onClick={() => remover(s)}
                      className="text-rm-red text-[12px]"
                    >
                      remover
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {msg && (
            <p className={msg.tipo === 'ok' ? 'text-[13px] text-rm-green' : 'text-[13px] text-rm-red'}>
              {msg.texto}
            </p>
          )}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-strong p-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <div className="max-w-[920px] mx-auto flex items-center gap-3">
          <span className="text-[13px] text-rm-mid flex-1">
            {seriais.length} etiqueta(s) · setor {setor.trim() || '—'}
          </span>
          <Button
            onClick={confirmar}
            disabled={pending || seriais.length === 0 || !setor.trim()}
          >
            {pending ? 'Baixando…' : `Baixar ${seriais.length}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
