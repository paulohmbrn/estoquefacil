// Cálculos da rotulagem nutricional brasileira (RDC 429/2020 + IN 75/2020).
//
// Os valores nutricionais são armazenados POR 100g/100ml (canônico). Estas
// funções calculam:
//   - valor por porção (com base na porção declarada do produto)
//   - %VD (percentual de valor diário) com base nos VD oficiais da IN 75
//   - selos frontais "ALTO EM…" conforme limites da RDC 429

export type CategoriaRDC429 = 'SOLIDO' | 'LIQUIDO' | 'REFEICAO_PRONTA';

export interface ValoresPor100 {
  unidadeBase: 'g' | 'ml';
  porcaoG: number | null;
  porcoesEmbalagem: number | null;
  porcaoMedidaCaseira: string | null;
  categoriaRDC429: CategoriaRDC429;

  valorEnergeticoKcal100: number | null;
  carboidratosG100: number | null;
  acucaresTotaisG100: number | null;
  acucaresAdicionadosG100: number | null;
  proteinasG100: number | null;
  gordurasTotaisG100: number | null;
  gordurasSaturadasG100: number | null;
  gordurasTransG100: number | null;
  fibrasG100: number | null;
  sodioMg100: number | null;
}

// VD oficiais da IN 75/2020 (adultos, dieta de 2000 kcal)
const VD = {
  kcal: 2000,
  carboidratos: 300,
  proteinas: 75,
  gordurasTotais: 55,
  gordurasSaturadas: 22,
  fibras: 25,
  sodio: 2000,        // mg
  acucaresAdicionados: 50, // g (10% da energia)
} as const;

export interface LinhaNutricional {
  rotulo: string;       // texto que aparece no rótulo
  unidade: string;      // "kcal" | "g" | "mg" | ""
  por100: number | null;
  porPorcao: number | null;
  vdPorcao: number | null; // % VD; null = não tem VD oficial
  indent: boolean;
}

function pct(valor: number, ref: number): number {
  return Math.round((valor / ref) * 100);
}

function porPorcao(valor100: number | null, porcao: number | null): number | null {
  if (valor100 === null || valor100 === undefined) return null;
  if (!porcao || porcao <= 0) return null;
  return (valor100 * porcao) / 100;
}

/**
 * Monta as linhas da tabela nutricional na ordem oficial RDC 429:
 *   Valor energético · Carboidratos · Açúcares totais · Açúcares adicionados ·
 *   Proteínas · Gorduras totais · Gorduras saturadas · Gorduras trans ·
 *   Fibra alimentar · Sódio.
 */
export function montarTabelaNutricional(v: ValoresPor100): LinhaNutricional[] {
  const p = v.porcaoG ?? null;
  const linha = (
    rotulo: string,
    unidade: string,
    val100: number | null,
    vdRef: number | null,
    indent = false,
  ): LinhaNutricional => {
    const valPorcao = porPorcao(val100, p);
    const vd = vdRef && valPorcao !== null ? pct(valPorcao, vdRef) : null;
    return { rotulo, unidade, por100: val100, porPorcao: valPorcao, vdPorcao: vd, indent };
  };

  return [
    linha('Valor energético', 'kcal', v.valorEnergeticoKcal100, VD.kcal),
    linha('Carboidratos totais', 'g', v.carboidratosG100, VD.carboidratos),
    linha('  Açúcares totais', 'g', v.acucaresTotaisG100, null, true),
    linha('  Açúcares adicionados', 'g', v.acucaresAdicionadosG100, VD.acucaresAdicionados, true),
    linha('Proteínas', 'g', v.proteinasG100, VD.proteinas),
    linha('Gorduras totais', 'g', v.gordurasTotaisG100, VD.gordurasTotais),
    linha('  Gorduras saturadas', 'g', v.gordurasSaturadasG100, VD.gordurasSaturadas, true),
    linha('  Gorduras trans', 'g', v.gordurasTransG100, null, true),
    linha('Fibra alimentar', 'g', v.fibrasG100, VD.fibras),
    linha('Sódio', 'mg', v.sodioMg100, VD.sodio),
  ];
}

export interface SelosFrontais {
  acucarAdicionado: boolean;
  gorduraSaturada: boolean;
  sodio: boolean;
}

/**
 * Calcula quais selos "ALTO EM…" devem aparecer no rótulo.
 * Limites da RDC 429/2020 — Anexo XI.
 */
export function calcularSelosFrontais(v: ValoresPor100): SelosFrontais {
  const cat = v.categoriaRDC429;

  // Para REFEICAO_PRONTA, usa limite por 100kcal (não por 100g/ml).
  if (cat === 'REFEICAO_PRONTA') {
    const kcal = v.valorEnergeticoKcal100;
    const por100kcal = (val100g: number | null): number | null => {
      if (val100g === null || !kcal || kcal <= 0) return null;
      return (val100g / kcal) * 100;
    };
    const aa = por100kcal(v.acucaresAdicionadosG100);
    const gs = por100kcal(v.gordurasSaturadasG100);
    const so = por100kcal(v.sodioMg100);
    return {
      acucarAdicionado: aa !== null && aa >= 7.5,
      gorduraSaturada: gs !== null && gs >= 3,
      sodio: so !== null && so >= 300,
    };
  }

  if (cat === 'LIQUIDO') {
    return {
      acucarAdicionado: (v.acucaresAdicionadosG100 ?? 0) >= 7.5,
      gorduraSaturada: (v.gordurasSaturadasG100 ?? 0) >= 3,
      sodio: (v.sodioMg100 ?? 0) >= 300,
    };
  }
  // SOLIDO
  return {
    acucarAdicionado: (v.acucaresAdicionadosG100 ?? 0) >= 15,
    gorduraSaturada: (v.gordurasSaturadasG100 ?? 0) >= 6,
    sodio: (v.sodioMg100 ?? 0) >= 600,
  };
}

/** Formata um número decimal para a tabela: 0..1 → "0,5"; 1..10 → "5,2"; ≥10 → "12". */
export function formatNum(n: number | null | undefined, casas = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(casas).replace('.', ',');
  return n.toFixed(casas).replace('.', ',');
}

export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${Math.round(n)}`;
}
