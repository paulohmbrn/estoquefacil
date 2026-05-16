'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  buscarProdutosControlado,
  gerarEtiquetasControladas,
} from '@/app/_actions/estoque-controlado';

type Prod = { id: string; nome: string; cdarvprod: string; unidade: string; fator: number };
const METODOS = ['CONGELADO', 'RESFRIADO', 'AMBIENTE'] as const;

export function GerarEtiquetasClient() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Prod[]>([]);
  const [sel, setSel] = useState<Prod | null>(null);
  const [qtd, setQtd] = useState(1);
  const [metodo, setMetodo] = useState<(typeof METODOS)[number]>('AMBIENTE');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [buscando, startBuscar] = useTransition();
  const [gerando, startGerar] = useTransition();
  const router = useRouter();

  function buscar(termo: string) {
    setQ(termo);
    setSel(null);
    if (termo.trim().length < 2) {
      setResultados([]);
      return;
    }
    startBuscar(async () => {
      const r = await buscarProdutosControlado(termo);
      setResultados(r.ok && r.data ? r.data : []);
    });
  }

  function gerar() {
    if (!sel || qtd < 1) return;
    setMsg(null);
    startGerar(async () => {
      const r = await gerarEtiquetasControladas({
        produtoId: sel.id,
        qtd,
        metodo,
        origem: 'AVULSO',
      });
      if (r.ok && r.data) {
        setMsg({ tipo: 'ok', texto: `${r.data.total} etiqueta(s) impressa(s) e ativadas.` });
        setSel(null);
        setQ('');
        setResultados([]);
        setQtd(1);
        router.refresh();
      } else if (!r.ok) {
        setMsg({ tipo: 'erro', texto: r.error });
      }
    });
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <label className="rm-eyebrow text-rm-mid block mb-1">Produto</label>
        <input
          value={q}
          onChange={(e) => buscar(e.target.value)}
          placeholder="Nome ou CDARVPROD (mín. 2 caracteres)"
          className="w-full border border-hairline rounded-xs px-3 py-2 text-[14px]"
        />
        {buscando && <p className="text-[12px] text-rm-mid mt-1">Buscando…</p>}
        {!sel && resultados.length > 0 && (
          <div className="mt-2 border border-hairline rounded-xs divide-y max-h-[240px] overflow-auto">
            {resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSel(p);
                  setResultados([]);
                  setQ(p.nome);
                }}
                className="block w-full text-left px-3 py-2 text-[13px] hover:bg-[rgba(0,65,37,.06)]"
              >
                <span className="font-medium">{p.nome}</span>
                <span className="text-rm-mid"> · {p.cdarvprod} · {p.unidade}</span>
                {p.fator !== 1 && (
                  <span className="text-rm-gold"> · fator {p.fator}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {sel && (
        <div className="text-[13px] bg-[rgba(0,65,37,.06)] rounded-xs px-3 py-2">
          <strong>{sel.nome}</strong> · {sel.cdarvprod} · {sel.unidade}
          {sel.fator !== 1 && <> · fator {sel.fator} (consolida na base)</>}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="rm-eyebrow text-rm-mid block mb-1">Quantidade</label>
          <input
            type="number"
            min={1}
            max={500}
            value={qtd}
            onChange={(e) => setQtd(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="w-24 border border-hairline rounded-xs px-3 py-2 text-[14px]"
          />
        </div>
        <div>
          <label className="rm-eyebrow text-rm-mid block mb-1">Método</label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as (typeof METODOS)[number])}
            className="border border-hairline rounded-xs px-3 py-2 text-[14px]"
          >
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={gerar} disabled={!sel || gerando}>
          {gerando ? 'Imprimindo…' : `Gerar ${qtd} etiqueta(s)`}
        </Button>
      </div>

      {msg && (
        <p
          className={
            msg.tipo === 'ok'
              ? 'text-[13px] text-rm-green'
              : 'text-[13px] text-rm-red'
          }
        >
          {msg.texto}
        </p>
      )}
    </Card>
  );
}
