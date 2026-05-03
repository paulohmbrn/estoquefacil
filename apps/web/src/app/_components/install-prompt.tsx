'use client';

// Captura o evento `beforeinstallprompt` (Chrome/Edge/Android) e mostra um botão.
// iOS Safari não suporta — mostra dica de "Adicionar à tela inicial" quando detectado.

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    const ua = navigator.userAgent;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      nav.standalone === true;
    if (standalone) setInstalled(true);
    if (/iPad|iPhone|iPod/.test(ua) && !standalone) setIsIOS(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  if (evt) {
    return (
      <button
        type="button"
        onClick={async () => {
          await evt.prompt();
          await evt.userChoice;
          setEvt(null);
        }}
        className="fixed bottom-4 right-4 z-30 ef-btn ef-btn-primary shadow-lift"
      >
        Instalar app
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSHint(true)}
          className="fixed bottom-4 right-4 z-30 ef-btn ef-btn-ghost shadow-card bg-white"
        >
          Instalar no iPhone
        </button>
        {showIOSHint && (
          <div
            className="fixed inset-0 z-50 bg-[rgba(10,26,16,.55)] flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowIOSHint(false)}
          >
            <div
              className="bg-white rounded-xs p-6 max-w-[420px] w-full border-t-[6px] border-rm-green"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="rm-eyebrow">Instalar no iPhone</p>
              <h3 className="rm-h4 mt-2">Adicionar à tela inicial</h3>
              <ol className="text-[13px] text-rm-ink-2 mt-4 space-y-3">
                <li>1. Toque no ícone <strong>Compartilhar</strong> (quadrado com seta) na barra do Safari.</li>
                <li>2. Role e selecione <strong>Adicionar à Tela de Início</strong>.</li>
                <li>3. Toque em <strong>Adicionar</strong> no canto superior direito.</li>
              </ol>
              <button
                onClick={() => setShowIOSHint(false)}
                className="ef-btn ef-btn-primary w-full mt-6 justify-center"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
