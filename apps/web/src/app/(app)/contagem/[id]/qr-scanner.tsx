'use client';

// Câmera QR via html5-qrcode com tratamento robusto pra iOS PWA standalone.
//  - id alfanumérico estável (não usa useId — React 19 emite caracteres
//    unicode `«»` que getElementById do html5-qrcode não acha)
//  - força playsinline + muted + autoplay no <video> injetado
//  - botão "Tentar novamente" recarrega a página (evita conflito de
//    re-init do scanner na mesma DOM)
//  - mensagens de erro específicas (NotAllowed, NotFound, NotReadable, etc)
//  - logs de console pra debug em produção quando der "Erro desconhecido"

import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  onScan: (text: string) => void;
  pause?: boolean;
}

type ScannerInstance = {
  stop: () => Promise<void>;
  clear: () => void;
  getState?: () => number;
};

function patchVideoElement(container: HTMLElement): void {
  const apply = () => {
    const video = container.querySelector('video');
    if (!video) return false;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.display = 'block';
    return true;
  };
  if (apply()) return;
  let attempts = 0;
  const tick = () => {
    if (apply() || attempts > 60) return;
    attempts += 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function explainError(err: unknown): { msg: string; needsPermission: boolean } {
  const e = err as { name?: string; message?: string; toString?: () => string };
  const name = e?.name ?? '';
  const raw = (e?.message || e?.toString?.() || '').trim();
  const lower = raw.toLowerCase();
  if (name === 'NotAllowedError' || /permission|notallowed|denied/i.test(lower)) {
    return {
      msg: 'Permissão de câmera negada. Vá em Ajustes do iPhone → Estoque Fácil → Câmera, libere e recarregue.',
      needsPermission: true,
    };
  }
  if (name === 'NotFoundError' || /not.?found|nodevice/.test(lower)) {
    return { msg: 'Nenhuma câmera traseira encontrada neste dispositivo.', needsPermission: false };
  }
  if (name === 'NotReadableError' || /already in use|notreadable/.test(lower)) {
    return { msg: 'Câmera ocupada por outro app. Feche o outro app e tente novamente.', needsPermission: false };
  }
  if (name === 'OverconstrainedError' || /overconstrain/.test(lower)) {
    return { msg: 'Câmera traseira indisponível — tente um dispositivo com câmera no fundo.', needsPermission: false };
  }
  if (/secure|https/.test(lower)) {
    return { msg: 'A câmera só funciona em HTTPS. Acesse via https://estoque.reismagos.com.br.', needsPermission: false };
  }
  return { msg: raw || 'Erro desconhecido ao abrir câmera. Tente recarregar a página.', needsPermission: false };
}

export function QrScanner({ onScan, pause }: Props) {
  // useId é estável entre SSR e client (Math.random não é, gera mismatch e
  // o getElementById falha porque o DOM ficou com o id do SSR).
  // Sanitizamos pra alfanumérico — html5-qrcode usa o id direto em
  // getElementById e querySelector, então não pode conter `«»` ou `:`.
  const rawId = useId();
  const containerId = `efqr${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);
  const scannerRef = useRef<ScannerInstance | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof window === 'undefined') return;
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Este navegador não suporta câmera (mediaDevices ausente).');
        }
        if (!window.isSecureContext) {
          throw new Error('Contexto inseguro — a câmera exige HTTPS.');
        }

        const target = document.getElementById(containerId);
        if (!target) {
          throw new Error(`Elemento "${containerId}" não encontrado no DOM.`);
        }

        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const Html5Qrcode = mod.Html5Qrcode;

        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner as unknown as ScannerInstance;

        const onDecoded = (decodedText: string): void => {
          const now = Date.now();
          if (
            lastScanRef.current &&
            lastScanRef.current.text === decodedText &&
            now - lastScanRef.current.at < 1500
          ) {
            return;
          }
          lastScanRef.current = { text: decodedText, at: now };
          onScan(decodedText);
        };
        const config = {
          fps: 10,
          qrbox: (vw: number, vh: number) => {
            const m = Math.floor(Math.min(vw, vh) * 0.7);
            return { width: m, height: m };
          },
          aspectRatio: 1.3333,
          disableFlip: false,
        };

        // Sequência de tentativas (do mais ideal pro mais permissivo):
        //   1) facingMode 'environment' (traseira via constraint nativa)
        //   2) facingMode 'user' (frontal — fallback notebook)
        //   3) listar câmeras via getCameras() e tentar cada uma por deviceId
        //
        // String literal NÃO funciona aqui — html5-qrcode trata string como
        // deviceId, e 'environment' não é um id, então retorna OverconstrainedError.
        const attempts: Array<{ label: string; cfg: MediaTrackConstraints | string }> = [
          { label: 'facingMode environment', cfg: { facingMode: 'environment' } },
          { label: 'facingMode user', cfg: { facingMode: 'user' } },
        ];
        let started = false;
        let lastError: unknown = null;
        for (const a of attempts) {
          try {
            await scanner.start(a.cfg, config, onDecoded, () => undefined);
            started = true;
            break;
          } catch (err) {
            lastError = err;
            // eslint-disable-next-line no-console
            console.warn(`[qr-scanner] ${a.label} falhou:`, err);
          }
        }
        if (!started) {
          // Última cartada: enumera câmeras e tenta a primeira por deviceId
          const cams = await mod.Html5Qrcode.getCameras().catch(() => [] as { id: string; label: string }[]);
          // eslint-disable-next-line no-console
          console.warn('[qr-scanner] getCameras retornou:', cams);
          const back = cams.find((c) => /back|rear|traseir|environment/i.test(c.label)) ?? cams[0];
          if (back) {
            try {
              await scanner.start(back.id, config, onDecoded, () => undefined);
              started = true;
            } catch (err) {
              lastError = err;
              // eslint-disable-next-line no-console
              console.warn('[qr-scanner] deviceId direto falhou:', err);
            }
          }
        }
        if (!started) {
          throw lastError ?? new Error('Nenhuma câmera disponível neste dispositivo.');
        }

        if (containerRef.current) patchVideoElement(containerRef.current);
        if (cancelled) {
          await scanner.stop().catch(() => undefined);
          return;
        }
        setRunning(true);
        setErro(null);
        setNeedsPermission(false);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[qr-scanner] falha ao iniciar:', e);
        const { msg, needsPermission: needs } = explainError(e);
        setErro(msg);
        setNeedsPermission(needs);
        setRunning(false);
        const inst = scannerRef.current;
        if (inst) {
          inst.stop().catch(() => undefined);
          scannerRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (!inst) return;
      inst
        .stop()
        .then(() => {
          try {
            inst.clear();
          } catch {
            /* ignore */
          }
        })
        .catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reload(): void {
    if (typeof window !== 'undefined') window.location.reload();
  }

  return (
    <div className="bg-rm-ink text-rm-cream relative overflow-hidden">
      <div
        id={containerId}
        ref={containerRef}
        className={pause ? 'opacity-30 pointer-events-none' : ''}
        style={{ width: '100%', minHeight: 320, position: 'relative' }}
      />
      {!running && !erro && (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] tracking-[.18em] uppercase opacity-80">
          Iniciando câmera…
        </div>
      )}
      {erro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3">
          <p className="text-[13px] leading-relaxed">{erro}</p>
          <button
            type="button"
            onClick={reload}
            className="ef-btn ef-btn-primary ef-btn-sm"
          >
            {needsPermission ? 'Recarregar página' : 'Tentar novamente'}
          </button>
        </div>
      )}
      {running && (
        <div className="absolute top-3 left-3 text-[10px] tracking-[.18em] uppercase bg-[rgba(0,0,0,.5)] px-2 py-1 rounded-xs">
          Câmera ativa · aponte para o QR
        </div>
      )}
    </div>
  );
}
