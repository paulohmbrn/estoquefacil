'use client';

// Registro do service worker. Só ativa em produção pra não interferir no
// hot-reload do Next durante o dev.
// - Verifica updates a cada navegação interna.
// - Quando o SW novo termina de ativar (postMessage SW_UPDATED), recarrega
//   a página automaticamente — assim o user pega CSS/HTML novos sem ter
//   que matar o app PWA manualmente.

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let reloaded = false;

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SW_UPDATED' && !reloaded) {
        reloaded = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Verifica updates periodicamente
          reg.update().catch(() => undefined);
          setInterval(() => reg.update().catch(() => undefined), 60_000);

          // Quando aparecer um SW em "waiting", manda skipWaiting pra ele assumir
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                nw.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[sw] registro falhou:', err);
        });
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  return null;
}
