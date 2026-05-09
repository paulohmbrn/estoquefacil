'use client';

// Botão "Imprimir etiquetas (Zebra 48×40)" na tela de detalhe da contagem.
// Dispara POST /api/etiquetas/contagem-realizada que gera 1 etiqueta por
// lançamento e despacha pro agente Argox via WS.

import { useState, useTransition } from 'react';

interface Props {
  contagemId: string;
  totalEtiquetas: number;
}

export function ImprimirEtiquetasButton({ contagemId, totalEtiquetas }: Props) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function imprimir() {
    setErro(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/etiquetas/contagem-realizada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contagemId }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
        alert(`✓ ${j.total ?? totalEtiquetas} etiqueta(s) enviadas pra Zebra.`);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={imprimir}
        disabled={pending || totalEtiquetas === 0}
        className="ef-btn ef-btn-ghost"
        title="Imprime 1 etiqueta por item da contagem (rolo Microline 48×40×02)"
      >
        {pending ? 'Imprimindo…' : `Etiquetas Zebra 48×40 (${totalEtiquetas})`}
      </button>
      {erro && (
        <span className="text-rm-red text-[12px] ml-2">{erro}</span>
      )}
    </>
  );
}
