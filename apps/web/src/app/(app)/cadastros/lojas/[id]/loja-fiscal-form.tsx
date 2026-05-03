'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { updateLojaFiscal, uploadCertificado, removerCertificado } from '@/app/_actions/loja-fiscal';

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
          setOkCert(`Certificado "${r.data.nome}" salvo (válido até ${new Date(r.data.validoAte).toLocaleDateString('pt-BR')}).${aviso}`);
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
                Válido até {new Date(loja.certValidoAte).toLocaleDateString('pt-BR')}
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

      {erro && <p className="text-rm-red text-[13px]">{erro}</p>}
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
