import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { qrDataUrl, listaQrUrl } from '@/lib/qr';
import { PageHead } from '@/components/shell/page-head';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProdutoSearch, type ProdutoOption } from './produto-search';
import { RemoveProdutoButton } from './remove-produto-button';

export default async function ListaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lojaId, papel } = await requireLojaAtiva();
  const isGestor = papel === 'GESTOR';

  const lista = await prisma.listaContagem.findUnique({
    where: { id },
    include: {
      produtos: {
        include: {
          produto: {
            include: { grupo: { select: { nome: true } }, subgrupo: { select: { nome: true } } },
          },
        },
        orderBy: { ordem: 'asc' },
      },
    },
  });

  if (!lista || lista.lojaId !== lojaId) notFound();

  // Catálogo da loja para autocomplete (limitado a ~3000 itens — leve enough)
  const todosProdutos = await prisma.produto.findMany({
    where: { lojaId, ativo: true },
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      cdarvprod: true,
      nome: true,
      unidade: true,
      grupo: { select: { nome: true } },
    },
  });

  const idsNaLista = new Set(lista.produtos.map((p) => p.produtoId));
  const opcoes: ProdutoOption[] = todosProdutos.map((p) => ({
    id: p.id,
    cdarvprod: p.cdarvprod,
    nome: p.nome,
    unidade: p.unidade,
    grupo: p.grupo?.nome ?? null,
    jaNaLista: idsNaLista.has(p.id),
  }));

  const qrUrl = listaQrUrl(lista.qrToken);
  const qrImg = await qrDataUrl(qrUrl, 256);

  return (
    <div className="max-w-[1240px] mx-auto">
      <PageHead
        eyebrow={
          <>
            <Link href="/listas" className="hover:underline">Listas</Link> · {lista.nome}
          </>
        }
        title={
          <>
            {lista.nome}
          </>
        }
        sub={`${lista.produtos.length} produtos · QR único · ${lista.tags.length > 0 ? lista.tags.join(' · ') : 'sem tags'}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          {isGestor && (
            <Card>
              <CardHeader><CardTitle>Adicionar produtos</CardTitle></CardHeader>
              <CardContent>
                <ProdutoSearch listaId={lista.id} produtos={opcoes} />
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden overflow-x-auto">
            <CardHeader>
              <CardTitle>Produtos da lista ({lista.produtos.length})</CardTitle>
            </CardHeader>
            {lista.produtos.length === 0 ? (
              <div className="p-10 text-center text-rm-mid text-[13px]">
                Nenhum produto ainda. Use o buscador acima para adicionar.
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left border-b border-hairline bg-[#fafaf7]">
                    <Th>#</Th>
                    <Th>CDARVPROD</Th>
                    <Th>Produto</Th>
                    <Th>Grupo / Subgrupo</Th>
                    <Th className="text-center">Un</Th>
                    {isGestor && <Th className="text-right">Ações</Th>}
                  </tr>
                </thead>
                <tbody>
                  {lista.produtos.map((pl, i) => (
                    <tr key={pl.produtoId} className="border-b border-hairline hover:bg-[rgba(0,65,37,.03)]">
                      <td className="px-4 py-2 rm-mono text-[11px] text-rm-mid">{i + 1}</td>
                      <td className="px-4 py-2 rm-mono text-[11.5px]">{pl.produto.cdarvprod}</td>
                      <td className="px-4 py-2 font-medium">{pl.produto.nome}</td>
                      <td className="px-4 py-2 text-rm-mid text-[11.5px]">
                        <span className="block truncate max-w-[260px]">{pl.produto.grupo?.nome ?? '—'}</span>
                        <span className="block text-rm-silt truncate max-w-[260px]">{pl.produto.subgrupo?.nome ?? ''}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="neutral">{pl.produto.unidade}</Badge>
                      </td>
                      {isGestor && (
                        <td className="px-4 py-2 text-right">
                          <RemoveProdutoButton listaId={lista.id} produtoId={pl.produtoId} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          {isGestor && lista.produtos.length > 0 && (
            <Card className="p-5 border-l-4 border-rm-green">
              <p className="rm-eyebrow text-rm-green">Atalho</p>
              <h3 className="rm-h4 mt-1 mb-2">Imprimir etiquetas desta lista</h3>
              <p className="text-[12px] text-rm-mid mb-3">
                Gera lote de etiquetas pra todos os {lista.produtos.length} produtos.
              </p>
              <Link
                href={`/etiquetas/lista?listaId=${lista.id}`}
                className="ef-btn ef-btn-primary w-full justify-center"
              >
                Imprimir etiquetas →
              </Link>
            </Card>
          )}

          <Card className="p-5 text-center">
            <p className="rm-eyebrow text-rm-mid">QR da lista</p>
            <h3 className="rm-h4 mt-1 mb-3">Imprima e cole na geladeira</h3>
            <div className="bg-white p-3 inline-block border border-hairline rounded-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImg} alt="QR da lista" width={224} height={224} />
            </div>
            <p className="rm-mono text-[10px] text-rm-mid mt-3 break-all">{qrUrl}</p>
            <a
              href={qrImg}
              download={`qr-lista-${lista.nome.toLowerCase().replace(/\s+/g, '-')}.png`}
              className="ef-btn ef-btn-ghost ef-btn-sm mt-4 w-full justify-center"
            >
              Baixar PNG
            </a>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={`px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] ${className ?? ''}`}>
      {children}
    </th>
  );
}
