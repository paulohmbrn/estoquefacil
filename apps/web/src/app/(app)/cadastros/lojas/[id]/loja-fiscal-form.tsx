'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  updateLojaFiscal,
  uploadCertificado,
  removerCertificado,
  updateArgoxBridge,
  ensureArgoxBridgeToken,
  rotateArgoxBridgeToken,
  getArgoxBridgeStatus,
} from '@/app/_actions/loja-fiscal';

interface LojaProps {
  id: string;
  zmartbiId: string;
  nome: string;
  cnpj: string;
  inscricaoEstadual: string;
  ufFiscal: string;
  certNome: string | null;
  certValidoAte: string | null;
  certUploadedAt: string | null;
  argoxBridgeUrl: string | null;
  argoxBridgeToken: string | null;
}

const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export function LojaFiscalForm({ loja }: { loja: LojaProps }) {
  const router = useRouter();
  const [pendingFiscal, startFiscal] = useTransition();
  const [pendingCert, startCert] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [okFiscal, setOkFiscal] = useState<string | null>(null);
  const [okCert, setOkCert] = useState<string | null>(null);

  // Auto-dismiss feedback de salvamento depois de 3s
  useEffect(() => {
    if (!okFiscal) return;
    const t = setTimeout(() => setOkFiscal(null), 3000);
    return () => clearTimeout(t);
  }, [okFiscal]);
  useEffect(() => {
    if (!okCert) return;
    const t = setTimeout(() => setOkCert(null), 4000);
    return () => clearTimeout(t);
  }, [okCert]);

  function salvarFiscal(formData: FormData) {
    setErro(null); setOkFiscal(null);
    startFiscal(async () => {
      const r = await updateLojaFiscal({
        lojaId: loja.id,
        cnpj: String(formData.get('cnpj') ?? ''),
        inscricaoEstadual: String(formData.get('inscricaoEstadual') ?? '') || null,
        ufFiscal: String(formData.get('ufFiscal') ?? '') || null,
      });
      if (r.ok) setOkFiscal('Dados salvos com sucesso.');
      else setErro(r.error);
    });
  }

  async function uploadCert(file: File, senha: string, opts?: { aceitarBaseDiferente?: boolean }): Promise<void> {
    setErro(null); setOkCert(null);
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const b64 = dataUrl.replace(/^data:[^,]+,/, '');
    return new Promise<void>((resolve) => {
      startCert(async () => {
        const r = await uploadCertificado({
          lojaId: loja.id,
          pfxBase64: b64,
          senha,
          aceitarBaseDiferente: opts?.aceitarBaseDiferente ?? false,
        });
        if (r.ok && r.data) {
          const aviso = r.data.avisoCnpj ? ` ⚠ ${r.data.avisoCnpj}` : '';
          setOkCert(`Certificado "${r.data.nome}" salvo (válido até ${new Date(r.data.validoAte).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}).${aviso}`);
          router.refresh();
        } else if (!r.ok) {
          if (r.requireConfirmCnpjBase) {
            const ok = window.confirm(
              `${r.error}\n\nDeseja salvar mesmo assim? (a SEFAZ provavelmente vai recusar)`,
            );
            if (ok) {
              await uploadCert(file, senha, { aceitarBaseDiferente: true });
              resolve();
              return;
            }
          }
          setErro(r.error);
        }
        resolve();
      });
    });
  }

  function removerCert() {
    if (!confirm('Remover o certificado desta loja? A integração SEFAZ vai parar até subir um novo.')) return;
    setErro(null); setOkCert(null);
    startCert(async () => {
      const r = await removerCertificado(loja.id);
      if (r.ok) {
        setOkCert('Certificado removido.');
        router.refresh();
      } else {
        setErro(r.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* DADOS FISCAIS */}
      <form action={salvarFiscal} className="space-y-4">
        <h3 className="rm-eyebrow">Dados fiscais</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="CNPJ">
            <Input name="cnpj" defaultValue={loja.cnpj} placeholder="00000000000000" inputMode="numeric" />
          </Field>
          <Field label="UF">
            <Input name="ufFiscal" defaultValue={loja.ufFiscal} placeholder="RN" maxLength={2} className="uppercase" />
          </Field>
          <Field label="Inscrição Estadual">
            <Input name="inscricaoEstadual" defaultValue={loja.inscricaoEstadual} placeholder="000.000.000.000" />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3">
          {okFiscal && <SavedBadge label={okFiscal} />}
          <Button type="submit" variant="primary" disabled={pendingFiscal}>
            {pendingFiscal ? 'Salvando…' : 'Salvar dados fiscais'}
          </Button>
        </div>
      </form>

      <hr className="border-dashed border-strong" />

      {/* CERTIFICADO */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="rm-eyebrow">Certificado digital A1</h3>
            <p className="text-[12px] text-rm-mid mt-1">
              Arquivo .pfx + senha. A senha é cifrada com AES-256-GCM antes de armazenar.
              O .pfx fica em <span className="rm-mono">/secrets/cert-{loja.zmartbiId}.pfx</span> no servidor.
            </p>
          </div>
          {loja.certNome && (
            <Badge variant="green">Configurado</Badge>
          )}
        </div>

        {loja.certNome && (
          <div className="bg-[#fafaf7] border border-hairline rounded-xs p-3 text-[13px]">
            <p className="font-medium">{loja.certNome}</p>
            {loja.certValidoAte && (
              <p className="text-[11px] text-rm-mid mt-1">
                Válido até {new Date(loja.certValidoAte).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                {loja.certUploadedAt && ` · enviado em ${dt.format(new Date(loja.certUploadedAt))}`}
              </p>
            )}
            <div className="mt-2">
              <button
                type="button"
                onClick={removerCert}
                disabled={pendingCert}
                className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-mid hover:text-rm-red"
              >
                Remover certificado
              </button>
            </div>
          </div>
        )}

        <UploadForm onUpload={uploadCert} pending={pendingCert} hasExisting={Boolean(loja.certNome)} />
        {okCert && (
          <div className="flex justify-end">
            <SavedBadge label={okCert} />
          </div>
        )}
      </div>

      <hr className="border-dashed border-strong" />

      <ArgoxBridgeBlock loja={loja} setErro={setErro} />

      {erro && <p className="text-rm-red text-[13px]">{erro}</p>}
    </div>
  );
}

function ArgoxBridgeBlock({
  loja,
  setErro,
}: {
  loja: LojaProps;
  setErro: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState(loja.argoxBridgeUrl ?? '');
  const [salvo, setSalvo] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(null), 3000);
    return () => clearTimeout(t);
  }, [salvo]);

  function salvar(): void {
    setErro(null); setSalvo(null);
    start(async () => {
      const r = await updateArgoxBridge({ lojaId: loja.id, argoxBridgeUrl: url || null });
      if (r.ok) {
        setSalvo('Salvo.');
        router.refresh();
      } else {
        setErro(r.error);
      }
    });
  }

  async function testar(): Promise<void> {
    setErro(null); setTestStatus('testing'); setTestMsg(null);
    if (!url) {
      setTestStatus('fail');
      setTestMsg('Cadastre a URL do agente primeiro.');
      return;
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${url.replace(/\/+$/, '')}/health`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json().catch(() => ({}));
      setTestStatus('ok');
      setTestMsg(`Agente OK · impressora ${j.printer ?? '(?)'}`);
    } catch (err) {
      const msg = (err as Error).message;
      setTestStatus('fail');
      setTestMsg(
        msg.includes('Failed to fetch') || msg.includes('aborted')
          ? 'Não consegui falar com o agente. Verifique se está rodando, se a URL está correta, e se você está na mesma rede.'
          : `Falhou: ${msg}`,
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="rm-eyebrow">Impressora Argox (rede local)</h3>
          <p className="text-[12px] text-rm-mid mt-1">
            URL do agente local que recebe o ZPL e repassa pra impressora térmica via TCP 9100.
            Use <span className="rm-mono">http://localhost:9101</span> se o agente roda no mesmo PC do app,
            ou <span className="rm-mono">http://192.168.x.x:9101</span> de outro PC da LAN.
          </p>
        </div>
        {loja.argoxBridgeUrl && <Badge variant="green">Configurado</Badge>}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:9101"
          className="flex-1"
        />
        <Button type="button" variant="ghost" onClick={() => void testar()} disabled={pending || testStatus === 'testing'}>
          {testStatus === 'testing' ? 'Testando…' : 'Testar conexão'}
        </Button>
        <Button type="button" variant="primary" onClick={salvar} disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar URL'}
        </Button>
      </div>
      {testMsg && (
        <p className={`text-[12px] ${testStatus === 'ok' ? 'text-rm-green' : 'text-rm-red'}`}>
          {testMsg}
        </p>
      )}
      {salvo && (
        <div className="flex justify-end">
          <SavedBadge label={salvo} />
        </div>
      )}

      <ArgoxTokenSubblock loja={loja} setErro={setErro} />
    </div>
  );
}

/** Sub-bloco: gerencia o token do agente WS (modo cloud, recomendado pra mobile). */
function ArgoxTokenSubblock({
  loja,
  setErro,
}: {
  loja: LojaProps;
  setErro: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [token, setToken] = useState<string | null>(loja.argoxBridgeToken);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; connectedAt: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      const r = await getArgoxBridgeStatus(loja.id);
      if (!cancelled && r.ok) setStatus(r.data ?? null);
    };
    void refresh();
    const t = setInterval(() => void refresh(), 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [loja.id]);

  function gerar(): void {
    setErro(null);
    start(async () => {
      const r = await ensureArgoxBridgeToken(loja.id);
      if (r.ok && r.data) { setToken(r.data.token); setRevealed(true); router.refresh(); }
      else if (!r.ok) setErro(r.error);
    });
  }

  function rotacionar(): void {
    if (!confirm('Rotacionar o token? O agente atual vai se desconectar e precisa receber o novo token no .env pra reconectar.')) return;
    setErro(null);
    start(async () => {
      const r = await rotateArgoxBridgeToken(loja.id);
      if (r.ok && r.data) { setToken(r.data.token); setRevealed(true); router.refresh(); }
      else if (!r.ok) setErro(r.error);
    });
  }

  return (
    <div className="mt-4 pt-4 border-t border-dashed border-strong space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="rm-eyebrow text-rm-mid">Conexão WebSocket (modo cloud)</p>
          <p className="text-[12px] text-rm-mid mt-1">
            Token único que o agente usa pra abrir conexão persistente com{' '}
            <span className="rm-mono">estoque.reismagos.com.br/argox</span>. Nesse modo qualquer dispositivo logado
            (mobile, tablet, PC) imprime — sem precisar estar na mesma rede da impressora.
          </p>
        </div>
        {status && (
          status.connected
            ? <Badge variant="green">Agente online</Badge>
            : <Badge variant="gold">Offline</Badge>
        )}
      </div>

      {token ? (
        <div className="bg-[#fafaf7] border border-hairline rounded-xs p-3 space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] rm-mono break-all">
              {revealed ? token : token.slice(0, 8) + '••••••••••••••••••••••••••••••••••••••••••••••••••••••••' + token.slice(-4)}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="text-[11px] rm-link"
            >
              {revealed ? 'esconder' : 'ver'}
            </button>
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(token); }}
              className="text-[11px] rm-link"
            >
              copiar
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={rotacionar}
              disabled={pending}
              className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-mid hover:text-rm-red"
            >
              Rotacionar token
            </button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="primary" onClick={gerar} disabled={pending}>
          {pending ? 'Gerando…' : 'Gerar token do agente'}
        </Button>
      )}

      {token && (
        <details className="text-[11px] text-rm-mid">
          <summary className="cursor-pointer text-rm-ink font-semibold">Como configurar no agente</summary>
          <pre className="mt-2 bg-white border border-hairline p-2 rounded-xs overflow-x-auto text-[10px]">{`# .env do agente Argox Bridge
PRINTER_HOST=192.168.x.x
PRINTER_PORT=9100
BRIDGE_TOKEN=${token}
SERVER_WS_URL=wss://estoque.reismagos.com.br/argox/agent`}</pre>
          <p className="mt-2">
            Salva no <span className="rm-mono">.env</span> do agente, reinicia o serviço, e veja o status virar &quot;Online&quot; aqui em alguns segundos.
          </p>
        </details>
      )}
    </div>
  );
}

function SavedBadge({ label }: { label: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-[12px] text-rm-green font-semibold animate-in fade-in slide-in-from-right-2 duration-300"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.12" />
        <path d="M4.5 8.2L7 10.7L11.7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}

function UploadForm({
  onUpload,
  pending,
  hasExisting,
}: {
  onUpload: (file: File, senha: string) => void | Promise<void>;
  pending: boolean;
  hasExisting: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (file && senha) void onUpload(file, senha);
      }}
      className="space-y-3 bg-white border border-dashed border-strong rounded-xs p-4"
    >
      <p className="text-[12px] text-rm-mid">
        {hasExisting ? 'Substituir certificado por um novo:' : 'Subir o certificado A1 (.pfx):'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Arquivo .pfx">
          <input
            type="file"
            accept=".pfx,.p12,application/x-pkcs12"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-[13px] file:mr-3 file:px-3 file:py-2 file:bg-rm-green file:text-rm-cream file:border-0 file:rounded-xs"
          />
        </Field>
        <Field label="Senha do certificado">
          <Input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!file || !senha || pending}>
          {pending ? 'Validando…' : hasExisting ? 'Substituir certificado' : 'Enviar certificado'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-1">{label}</span>
      {children}
    </label>
  );
}
