import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/shell/brand';

interface SearchParams {
  error?: string;
  email?: string;
  callbackUrl?: string;
}

const ERRO_LABELS: Record<string, string> = {
  DomainNotAllowed: 'E-mail fora do domínio autorizado',
  EmailNotVerified: 'E-mail Google não verificado',
  Configuration: 'Erro de configuração — fale com o suporte',
  AccessDenied: 'Acesso negado',
  Verification: 'Link de verificação expirou',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (session?.user) redirect('/');

  const params = await searchParams;
  const erro = params.error ? ERRO_LABELS[params.error] ?? 'Não foi possível entrar' : null;
  const callbackUrl = params.callbackUrl || '/';

  async function entrar() {
    'use server';
    await signIn('google', { redirectTo: callbackUrl });
  }

  return (
    <main className="ef-grain min-h-screen flex flex-col">
      <header className="px-10 py-8 flex items-center gap-3">
        <BrandMark size={32} />
        <span className="font-sans uppercase text-[10px] tracking-[.22em] text-rm-mid font-semibold">
          Estoque · Fácil
        </span>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 px-10 lg:px-20 pb-16 items-center max-w-[1280px] w-full mx-auto">
        <section className="space-y-7">
          <p className="rm-eyebrow">Famiglia Reis Magos · Madre Pane</p>
          <h1 className="rm-display" style={{ fontSize: '88px' }}>
            contagem que <em>respira</em>
          </h1>
          <p className="rm-body max-w-[52ch]">
            Sistema interno para contagem e controle de estoque das operações Reis Magos.
            Sincroniza com o ERP Teknisa, gera etiquetas térmicas com QR e exporta
            o ajuste do dia em um clique.
          </p>
          <p className="rm-meta text-rm-mid">10 Lojas · ZmartBI · MVP 2026</p>
        </section>

        <aside className="bg-white border border-hairline shadow-card rounded-xs p-8 lg:p-10">
          <div className="space-y-2 mb-7">
            <p className="rm-eyebrow">Acesso</p>
            <h2 className="rm-h2">Entrar</h2>
            <p className="rm-caption">
              Use sua conta Google corporativa <span className="rm-mono text-rm-ink">@reismagos.com.br</span>.
            </p>
          </div>

          <form action={entrar}>
            <Button type="submit" variant="primary" size="lg" className="w-full">
              <GoogleGlyph />
              Entrar com Google
            </Button>
          </form>

          {erro && (
            <div
              className="mt-5 px-4 py-3 border border-rm-red text-rm-red rounded-xs text-[13px]"
              role="alert"
            >
              <strong className="font-semibold">{erro}.</strong>{' '}
              {params.email && (
                <span className="rm-mono text-[12px] block mt-1">{params.email}</span>
              )}
              <span className="block mt-2 text-[12px] text-rm-ink-3">
                Fale com o gestor da sua loja para liberação.
              </span>
            </div>
          )}

          <div className="mt-7 pt-5 border-t border-dashed border-strong">
            <p className="rm-meta text-rm-mid">Suporte</p>
            <p className="rm-caption mt-1">
              Sem acesso ainda? Procure o gestor da sua filial. Sem login mas precisa aparecer
              em uma contagem? O gestor pode te cadastrar como funcionário sem login.
            </p>
          </div>
        </aside>
      </div>

      <footer className="px-10 py-5 border-t border-hairline flex items-center justify-between text-[10px] tracking-[.22em] uppercase text-rm-mid font-semibold">
        <span>Reis Magos · Estoque Fácil v0.1</span>
        <span>2026</span>
      </footer>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#FFC107"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.13 4.13 0 0 1-1.79 2.71v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.61z"
      />
      <path
        fill="#FF3D00"
        d="M9 18c2.43 0 4.47-.81 5.96-2.19l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34A8.99 8.99 0 0 0 9 18z"
      />
      <path
        fill="#4CAF50"
        d="M3.95 10.69A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.69V4.97H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.03l2.99-2.34z"
      />
      <path
        fill="#1976D2"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.34l2.58-2.58A8.99 8.99 0 0 0 9 0 8.99 8.99 0 0 0 .96 4.97l2.99 2.34C4.66 5.18 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
