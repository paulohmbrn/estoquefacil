// As 10 filiais do MVP (CDFILIAL no ZmartBI).
// Mantenha sincronizado com prisma/seed.ts.
export const FILIAIS_MVP = [
  '0001',
  '0003',
  '0004',
  '0005',
  '0006',
  '0008',
  '0016',
  '0017',
  '0019',
  '0023',
] as const;

export type CdFilialMvp = (typeof FILIAIS_MVP)[number];

export const FILIAIS_MVP_SET: ReadonlySet<string> = new Set(FILIAIS_MVP);

// Prefixos de CDARVPROD que são contáveis no MVP.
// 1*     = MATERIA PRIMA / ALIMENTOS
// 30105* = USO CONSUMO
// 915*   = BEBIDAS
export const PREFIXOS_CDARVPROD_MVP = ['1', '30105', '915'] as const;

// Apenas SKUs (CDARVPROD com 13 chars) entram em contagem.
// CDARVPROD com 11 chars são agrupadores (categoria/nome lógico) e devem ser ignorados.
export const CDARVPROD_LEN_SKU = 13;

// SKU de estoque ZmartBI: 13 chars + prefixo MVP + termina em "00".
// Os outros sufixos representam preparações/receitas que NÃO são contadas fisicamente
// (consumo é deduzido via ficha técnica do SKU base terminado em 00).
export function isCdarvprodContavel(cdarvprod: string): boolean {
  if (cdarvprod.length !== CDARVPROD_LEN_SKU) return false;
  if (!cdarvprod.endsWith('00')) return false;
  return PREFIXOS_CDARVPROD_MVP.some((p) => cdarvprod.startsWith(p));
}

// ZmartBI
export const ZMARTBI_LOCK_BACKOFF_MIN_MS = 5 * 60 * 1000; // 5 min mínimo entre tentativas
export const ZMARTBI_NRORG = 1148;
export const ZMARTBI_CD_EMPRESA = '01';

// Auth
export const ALLOWED_EMAIL_DOMAIN_DEFAULT = 'reismagos.com.br';

// Etiqueta
export const ETIQUETA_TAMANHO_MM = { largura: 60, altura: 60 } as const;
