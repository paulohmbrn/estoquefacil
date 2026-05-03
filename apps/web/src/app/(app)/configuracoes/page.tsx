import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logout } from '@/app/_actions/auth';

export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const vinculos = await prisma.usuarioLoja.findMany({
    where: { userId: user.id, ativo: true },
    include: { loja: { select: { zmartbiId: true, nome: true, apelido: true } } },
    orderBy: { loja: { zmartbiId: 'asc' } },
  });

  return (
    <div className="max-w-[840px] mx-auto space-y-5">
      <PageHead
        eyebrow="Sistema · Configurações"
        title={
          <>
            Suas <em>preferências</em>
          </>
        }
        sub="Conta, lojas vinculadas e ações de sessão."
      />

      <Card>
        <CardHeader><CardTitle>Conta</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-[13px]">
          <Row label="Nome">{user.name ?? '—'}</Row>
          <Row label="E-mail"><span className="rm-mono">{user.email}</span></Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lojas vinculadas ({vinculos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {vinculos.length === 0 ? (
            <p className="text-rm-mid text-[13px]">
              Sem vínculo. Vá em <Link href="/onboarding/lojas" className="rm-link">minhas lojas</Link>.
            </p>
          ) : (
            <ul className="space-y-2">
              {vinculos.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between bg-[#fafaf7] border border-hairline rounded-xs px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-[13px]">
                      {v.loja.apelido ?? v.loja.nome}
                    </p>
                    <p className="text-[10px] tracking-[.18em] uppercase text-rm-mid mt-1">
                      #{v.loja.zmartbiId}
                    </p>
                  </div>
                  <Badge variant={v.papel === 'GESTOR' ? 'gold' : 'green'}>
                    {v.papel === 'GESTOR' ? 'Gestor' : 'Operador'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-3 border-t border-dashed border-hairline">
            <Link href="/onboarding/lojas" className="ef-btn ef-btn-ghost ef-btn-sm">
              Gerenciar minhas lojas →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sobre</CardTitle></CardHeader>
        <CardContent className="text-[13px] text-rm-mid space-y-2">
          <p>Estoque Fácil — versão de desenvolvimento</p>
          <p className="text-[11px]">
            Famiglia Reis Magos · Madre Pane · {new Date().getFullYear()}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sessão</CardTitle></CardHeader>
        <CardContent>
          <form action={logout}>
            <button type="submit" className="ef-btn ef-btn-danger">
              Sair desta conta
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-dashed border-hairline last:border-0">
      <span className="text-rm-mid text-[11px] uppercase tracking-[.16em]">{label}</span>
      <span className="text-rm-ink font-medium text-right">{children}</span>
    </div>
  );
}
