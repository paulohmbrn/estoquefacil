// Defaults de método de conservação + validade aplicados automaticamente
// quando o sync ZmartBI traz um produto novo, baseado no nome do GRUPO ou SUBGRUPO.
//
// Regra de precedência: subgrupo (mais específico) > grupo.
// Edições manuais NUNCA são sobrescritas — defaults só populam ProdutoMeta
// quando ainda não existe meta pro produto.

const RESFRIADO_GRUPOS_RAW = [
  'AVES IN NATURA',
  'AVES PROCESSADAS',
  'BOVINAS IN NATURA',
  'BOVINAS PRE PROCESSADAS',
  'CARNES DIVERSAS PRE PROCESSADAS',
  'FRUTOS DO MAR IN NATURA',
  'FRUTOS DO MAR PRE PROCESSADOS',
  'PEIXES IN NATURA',
  'PEIXES PRE PROCESSADOS',
  'SUINAS IN NATURA',
  'SUINAS PRE PROCESSADAS',
  'MASSAS DE PIZZA',
  'SUCOS',
  'DOCES E SOBREMESAS',
  'HORTIFRUTIGRANJEIROS',
  'FRIOS E LATICINIOS',
  'PANIFICACAO',
  'AVES, BOVINOS, SUINOS, PEIXES E FRUTOS DO MAR',
];

const CONGELADO_SUBGRUPOS_RAW = [
  'SORVETE SOFT',
  'SORVETES',
  'CONGELADOS PRONTOS',
  'GELO',
];

const AMBIENTE_GRUPOS_RAW = [
  'ADICIONAIS BEBIDAS',
  'CAFES & CHOC QUENTE',
  'COCKTAILS',
  'DESCARTAVEIS E EMBALAGENS',
  'ESPECIARIAS',
  'MERCEARIA',
  'VINHOS',
  'REFRIGERANTES',
  'AGUAS',
  'BEBIDAS',
  'CERVEJAS',
  'DESTILADOS',
  'ENERGETICOS',
];

/** Normaliza pra comparar nomes vindos do ZmartBI:
 *  - uppercase
 *  - trim
 *  - remove acentos (Á → A, Ç → C…)
 *  - colapsa espaços múltiplos */
export function normalizeGrupoNome(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const RESFRIADO_GRUPOS = new Set(RESFRIADO_GRUPOS_RAW.map(normalizeGrupoNome));
const CONGELADO_SUBGRUPOS = new Set(CONGELADO_SUBGRUPOS_RAW.map(normalizeGrupoNome));
const AMBIENTE_GRUPOS = new Set(AMBIENTE_GRUPOS_RAW.map(normalizeGrupoNome));

export type Metodo = 'congelado' | 'resfriado' | 'ambiente';

export interface ProdutoMetaDefaults {
  metodos: Metodo[];
  validadeResfriado: number | null;
  validadeCongelado: number | null;
  validadeAmbiente: number | null;
  observacoes: string | null;
}

/** Decide o método/validade default a partir do nome do grupo/subgrupo do produto.
 *  Retorna `null` se o produto não bate em nenhuma regra (não cria meta automática). */
export function inferProdutoMetaDefaults(args: {
  grupoNome?: string | null;
  subgrupoNome?: string | null;
}): ProdutoMetaDefaults | null {
  const g = normalizeGrupoNome(args.grupoNome);
  const sg = normalizeGrupoNome(args.subgrupoNome);

  // Congelado: bate em subgrupo OU grupo (no ZmartBI alguns nomes da lista de subgrupos
  // — ex.: "CONGELADOS PRONTOS" — também aparecem como grupo). Tem precedência por ser o caso
  // mais específico de risco sanitário.
  if ((sg && CONGELADO_SUBGRUPOS.has(sg)) || (g && CONGELADO_SUBGRUPOS.has(g))) {
    return {
      metodos: ['congelado'],
      validadeResfriado: null,
      validadeCongelado: 90,
      validadeAmbiente: null,
      observacoes: null,
    };
  }

  if (g && AMBIENTE_GRUPOS.has(g)) {
    return {
      metodos: ['ambiente'],
      validadeResfriado: null,
      validadeCongelado: null,
      validadeAmbiente: null,
      observacoes: 'Validade: ver embalagem',
    };
  }

  if (g && RESFRIADO_GRUPOS.has(g)) {
    return {
      metodos: ['resfriado'],
      validadeResfriado: 7,
      validadeCongelado: null,
      validadeAmbiente: null,
      observacoes: null,
    };
  }

  return null;
}
