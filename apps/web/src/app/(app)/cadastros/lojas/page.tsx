// /cadastros/lojas — Gestor edita CNPJ/IE/UF + sobe certificado A1 por loja.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

export default async function CadastroLojasPage() {
  const user = await requireUser();
  // Lojas onde o user é Gestor
  const vinculos = await prisma.usuarioLoja.findMany({
    where: { userId: user.id, ativo: true, papel: 'GESTOR' },
    include: {
      loja: {
        select: {
          id: true,
          zmartbiId: true,
          nome: true,
          apelido: true,
          cnpj: true,
          inscricaoEstadual: true,
          ufFiscal: true,
          certificadoNome: true,
          certificadoValidoAte: true,
          certificadoUploadedAt: true,
          ultimoNsuSefaz: true,
        },
      },
    },
    orderBy: { loja: { zmartbiId: 'asc' } },
  });

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow="Cadastros · Lojas"
        title={
          <>
            Configuração <em>fiscal</em>
          </>
        }
        sub="CNPJ, IE e certificado digital A1 por loja. Apenas Gestor da loja vê e edita seus dados."
      />

      {vinculos.length === 0 ? (
        <Card className="p-8 text-center text-rm-mid text-[13px]">
          Você não é Gestor de nenhuma loja ainda.
        </Card>
      ) : (
        <ul className="space-y-3">
          {vinculos.map((v) => {
            const l = v.loja;
            const certVenceEm = l.certificadoValidoAte
              ? Math.floor((l.certificadoValidoAte.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const certCor =
              certVenceEm === null
                ? 'neutral'
                : certVenceEm < 0
                ? 'red'
                : certVenceEm < 30
                ? 'gold'
                : 'green';
            return (
              <li key={l.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div>
                      <p className="rm-eyebrow text-rm-mid">#{l.zmartbiId}</p>
                      <h3 className="font-sans font-bold text-[18px] mt-1">
                        {l.apelido ?? l.nome}
                      </h3>
                    </div>
                    <Link
                      href={`/cadastros/lojas/${l.id}`}
                      className="ef-btn ef-btn-ghost ef-btn-sm self-start"
                    >
                      Editar →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                    <Field label="CNPJ">{l.cnpj ? formatCnpj(l.cnpj) : <em className="text-rm-mid">—</em>}</Field>
                    <Field label="IE">{l.inscricaoEstadual ?? <em className="text-rm-mid">—</em>}</Field>
                    <Field label="UF">{l.ufFiscal ?? <em className="text-rm-mid">—</em>}</Field>
                  </div>

                  <div className="mt-3 pt-3 border-t border-dashed border-hairline">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="rm-eyebrow text-rm-mid">Certificado A1</p>
                        <p className="text-[13px] mt-1">
                          {l.certificadoNome ?? <em className="text-rm-mid">não enviado</em>}
                        </p>
                        {l.certificadoValidoAte && (
                          <p className="text-[11px] text-rm-mid mt-1">
                            Válido até {dt.format(l.certificadoValidoAte)}
                          </p>
                        )}
                      </div>
                      <Badge variant={certCor as 'neutral' | 'red' | 'gold' | 'green'}>
                        {certVenceEm === null
                          ? 'Sem cert'
                          : certVenceEm < 0
                          ? 'Vencido'
                          : certVenceEm < 30
                          ? `${certVenceEm}d`
                          : 'OK'}
                      </Badge>
                    </div>
                  </div>

                  {l.ultimoNsuSefaz && l.ultimoNsuSefaz !== '0' && (
                    <p className="text-[10px] tracking-[.16em] uppercase text-rm-mid mt-3 rm-mono">
                      último NSU SEFAZ: {l.ultimoNsuSefaz}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] tracking-[.18em] uppercase text-rm-mid font-semibold">{label}</p>
      <p className="mt-1 text-rm-ink-2 font-medium">{children}</p>
    </div>
  );
}

function formatCnpj(s: string): string {
  if (s.length !== 14) return s;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}
