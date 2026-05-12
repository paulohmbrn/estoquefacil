import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireGestor } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { LojaFiscalForm } from './loja-fiscal-form';

export default async function EditarLojaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Garante que o user é Gestor desta loja
  await requireGestor({ lojaId: id });

  const loja = await prisma.loja.findUnique({
    where: { id },
    select: {
      id: true,
      zmartbiId: true,
      nome: true,
      apelido: true,
      cnpj: true,
      inscricaoEstadual: true,
      ufFiscal: true,
      razaoSocial: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      municipio: true,
      cep: true,
      telefone: true,
      certificadoNome: true,
      certificadoValidoAte: true,
      certificadoUploadedAt: true,
      argoxBridgeUrl: true,
      argoxBridgeToken: true,
    },
  });
  if (!loja) notFound();

  return (
    <div className="max-w-[720px] mx-auto">
      <PageHead
        eyebrow={
          <>
            <Link href="/cadastros/lojas" className="hover:underline">Lojas</Link> · {loja.apelido ?? loja.nome}
          </>
        }
        title={
          <>
            Editar <em>{loja.apelido ?? loja.nome}</em>
          </>
        }
        sub="Dados fiscais, identificação do fabricante (rótulo), certificado A1 (SEFAZ) e impressora Argox."
      />

      <Card className="p-5">
        <LojaFiscalForm
          loja={{
            id: loja.id,
            zmartbiId: loja.zmartbiId,
            nome: loja.apelido ?? loja.nome,
            cnpj: loja.cnpj ?? '',
            inscricaoEstadual: loja.inscricaoEstadual ?? '',
            ufFiscal: loja.ufFiscal ?? '',
            razaoSocial: loja.razaoSocial ?? '',
            logradouro: loja.logradouro ?? '',
            numero: loja.numero ?? '',
            complemento: loja.complemento ?? '',
            bairro: loja.bairro ?? '',
            municipio: loja.municipio ?? '',
            cep: loja.cep ?? '',
            telefone: loja.telefone ?? '',
            certNome: loja.certificadoNome,
            certValidoAte: loja.certificadoValidoAte?.toISOString() ?? null,
            certUploadedAt: loja.certificadoUploadedAt?.toISOString() ?? null,
            argoxBridgeUrl: loja.argoxBridgeUrl,
            argoxBridgeToken: loja.argoxBridgeToken,
          }}
        />
      </Card>
    </div>
  );
}
