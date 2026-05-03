'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

type Result = {
  id: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  grupo: string | null;
};

export function HeaderSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/produtos?q=${encodeURIComponent(query.trim())}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { produtos?: Result[] };
        setResults(data.produtos ?? []);
        setOpen(true);
      } catch {
        /* abort/erro silenciado */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  // Fecha ao clicar fora
  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  function selecionar(p: Result) {
    setOpen(false);
    setQuery('');
    router.push(`/cadastros/produtos/${p.id}`);
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-[400px]">
      <div className="flex items-center gap-2 h-[34px] px-3 bg-[#f6f5f1] border border-hairline rounded-xs text-[13px]">
        <Search size={14} className="text-rm-mid shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar produto, CDARVPROD…"
          className="bg-transparent flex-1 outline-none text-rm-ink placeholder:text-rm-mid min-w-0"
        />
        {query && (
          <button
            type="button"
            className="text-rm-mid hover:text-rm-ink"
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-hairline rounded-xs shadow-lift z-50 max-h-[400px] overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-[12px] text-rm-mid">Buscando…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-3 text-[12px] text-rm-mid text-center">
              Nada encontrado pra &quot;{query}&quot;
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selecionar(r)}
              className="w-full text-left px-3 py-2 border-b border-hairline last:border-0 hover:bg-[rgba(0,65,37,.04)]"
            >
              <p className="text-[13px] font-medium text-rm-ink truncate">{r.nome}</p>
              <p className="text-[10px] tracking-[.14em] uppercase text-rm-mid mt-1">
                <span className="rm-mono">{r.cdarvprod}</span>
                {' · '}{r.unidade}{r.grupo ? ` · ${r.grupo}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
