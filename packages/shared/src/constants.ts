// As 10 filiais do MVP (CDFILIAL no ZmartBI).
// Mantenha sincronizado com prisma/seed.ts.
export const FILIAIS_MVP = [
  '0001',
  '0003',
  '0004',
  '0005',
  '0006',
  '0008',
  '0013',
  '0016',
  '0017',
  '0019',
  '0023',
] as const;

export type CdFilialMvp = (typeof FILIAIS_MVP)[number];

export const FILIAIS_MVP_SET: ReadonlySet<string> = new Set(FILIAIS_MVP);

// Pizzarias Famiglia Reis Magos (CDFILIAL/zmartbiId). Nelas o prefixo "1"
// conta SEM exigir terminar em "00" (receitas/sub-itens entram em contagem).
// FFB (0013) e Madre Pane (0023) NÃO entram aqui — operam por prefixo extra.
export const FILIAIS_REIS_MAGOS: readonly string[] = [
  '0001',
  '0003',
  '0004',
  '0005',
  '0006',
  '0008',
  '0016',
  '0017',
  '0019',
] as const;

export const FILIAIS_REIS_MAGOS_SET: ReadonlySet<string> = new Set(FILIAIS_REIS_MAGOS);

// Lojas com Estoque Controlado (etiqueta por unidade + fator de conversão):
// as 9 pizzarias Reis Magos + Madre Pane (0023). FFB (0013) fora.
export const FILIAIS_ESTOQUE_CONTROLADO: readonly string[] = [
  ...FILIAIS_REIS_MAGOS,
  '0023',
] as const;

export const FILIAIS_ESTOQUE_CONTROLADO_SET: ReadonlySet<string> = new Set(
  FILIAIS_ESTOQUE_CONTROLADO,
);

// Prefixos de CDARVPROD que são contáveis no MVP (em todas as lojas).
// 1*     = MATERIA PRIMA / ALIMENTOS
// 30105* = USO CONSUMO
// 915*   = BEBIDAS
export const PREFIXOS_CDARVPROD_MVP = ['1', '30105', '915'] as const;

// Prefixos extras por loja — filiais específicas têm tipos de produto que não
// existem nas outras. Esses prefixos NÃO seguem a regra de "endsWith('00')"
// (panificação artesanal não usa SKU-base + receitas como o resto do ZmartBI).
//   0013 = FFB ALIMENTOS (fábrica) → todos os 1* e 2* (insumos e produzidos)
//   0023 = MADRE PANE - LAGOA NOVA → todos os 903* (panificação)
export const PREFIXOS_CDARVPROD_EXTRAS_POR_FILIAL: Readonly<Record<string, readonly string[]>> = {
  '0013': ['1', '2'],
  '0023': ['903'],
};

// Apenas SKUs (CDARVPROD com 13 chars) entram em contagem.
// CDARVPROD com 11 chars são agrupadores (categoria/nome lógico) e devem ser ignorados.
export const CDARVPROD_LEN_SKU = 13;

// Produto de estoque base da família: mesmos 11 primeiros chars + sufixo "00".
// A consolidação soma Σ(qtd × FATOR_CONVERSAO) agrupando por este código.
// O ZmartBI não traz campo de vínculo — a ligação é derivada do código.
export function cdarvprodEstoqueBase(cdarvprod: string): string {
  if (cdarvprod.length !== CDARVPROD_LEN_SKU) return cdarvprod;
  return cdarvprod.slice(0, 11) + '00';
}

// SKU de estoque ZmartBI: 13 chars com regras diferentes por origem do prefixo:
//   • prefixo MVP (1, 30105, 915) → exige terminar em "00" (SKU-base; o resto é receita)
//   • prefixo extra da loja → SEM regra de sufixo (cada item é o SKU final)
//
// `cdfilial` opcional: quando passado, considera os prefixos extras daquela filial.
export function isCdarvprodContavel(cdarvprod: string, cdfilial?: string): boolean {
  if (cdarvprod.length !== CDARVPROD_LEN_SKU) return false;
  // Caminho MVP: termina em "00" + prefixo MVP
  if (
    cdarvprod.endsWith('00') &&
    PREFIXOS_CDARVPROD_MVP.some((p) => cdarvprod.startsWith(p))
  ) return true;
  // Lojas com Estoque Controlado (9 pizzarias RM + Madre Pane 0023): qualquer
  // SKU 13ch de prefixo MVP conta SEM exigir terminar em "00". Necessário pra
  // capturar produtos de compra (ex. 915…01/02 C/12, C/6) e receitas — toda a
  // família é consolidada por cdarvprodEstoqueBase via FATOR_CONVERSAO.
  // Decisão de Paulo (2026-05-16) — generaliza a regra do prefixo "1".
  if (
    cdfilial &&
    FILIAIS_ESTOQUE_CONTROLADO_SET.has(cdfilial) &&
    PREFIXOS_CDARVPROD_MVP.some((p) => cdarvprod.startsWith(p))
  ) return true;
  // Caminho extra por filial: prefixo extra cadastrado, sem regra de sufixo
  const extras = cdfilial ? PREFIXOS_CDARVPROD_EXTRAS_POR_FILIAL[cdfilial] ?? [] : [];
  return extras.some((p) => cdarvprod.startsWith(p));
}

// ZmartBI
export const ZMARTBI_LOCK_BACKOFF_MIN_MS = 5 * 60 * 1000; // 5 min mínimo entre tentativas
export const ZMARTBI_NRORG = 1148;
export const ZMARTBI_CD_EMPRESA = '01';

// Auth — múltiplos domínios da empresa permitidos no SSO Google.
// Quem loga com qualquer um deles entra; é autoelegível a Gestor das lojas MVP.
export const ALLOWED_EMAIL_DOMAINS_DEFAULT: readonly string[] = [
  'reismagos.com.br',
  'madrepanepadaria.com.br',
  'ffbalimentos.com.br',
];

/** Mantido por retrocompat (algumas mensagens UI ainda mostram um domínio "principal"). */
export const ALLOWED_EMAIL_DOMAIN_DEFAULT = ALLOWED_EMAIL_DOMAINS_DEFAULT[0]!;

/** Resolve a whitelist a partir do ENV. Aceita:
 *   - ALLOWED_EMAIL_DOMAINS=foo.com,bar.com  (lista separada por vírgula)
 *   - ALLOWED_EMAIL_DOMAIN=foo.com           (legado, string única)
 *   - undefined                              → usa default da const acima */
export function resolveAllowedDomains(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string[] {
  const raw = env.ALLOWED_EMAIL_DOMAINS ?? env.ALLOWED_EMAIL_DOMAIN ?? '';
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...ALLOWED_EMAIL_DOMAINS_DEFAULT];
}

/** Testa se o e-mail bate com algum domínio permitido. */
export function isEmailDomainAllowed(email: string, domains: readonly string[]): boolean {
  const lower = email.toLowerCase();
  return domains.some((d) => lower.endsWith(`@${d}`));
}

// Etiqueta
export const ETIQUETA_TAMANHO_MM = { largura: 60, altura: 60 } as const;

// Lojas que exigem a coluna CDALMOXARIFE no export pro ZmartBI.
// Capim Macio (0001) tem o ERP configurado em modo multi-almoxarife;
// o resto das filiais não envia esse campo. Mapa filial → cdAlmoxarife
// fixo (sempre 1 hoje, mas vira variável se outra loja entrar).
export const CDALMOXARIFE_POR_FILIAL: Readonly<Record<string, number>> = {
  '0001': 1,
};

export function cdAlmoxarifePorFilial(cdFilial: string): number | null {
  return CDALMOXARIFE_POR_FILIAL[cdFilial] ?? null;
}

// Lojas habilitadas a imprimir o rótulo industrializado RDC 429
// (etiqueta nutricional 100×100mm). FFB e Madre Pane têm produção própria
// e precisam de rótulo regulamentado; as demais lojas só revendem.
export const LOJAS_COM_ROTULO_NUTRICIONAL: readonly string[] = ['0013', '0023'];

export function lojaPodeRotular(zmartbiId: string | null | undefined): boolean {
  if (!zmartbiId) return false;
  return LOJAS_COM_ROTULO_NUTRICIONAL.includes(zmartbiId);
}
