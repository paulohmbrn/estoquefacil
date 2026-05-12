/**
 * Gera um arquivo .zpl de teste pro rótulo 100×100mm, pra calibrar a impressora
 * (MARGEM_ESQ) e conferir o layout/logo sem precisar passar pelo app.
 *
 *   pnpm --filter web exec tsx scripts/gerar-rotulo-teste.mts [arquivo-saida.zpl]
 *
 * Gera 3 etiquetas no mesmo arquivo:
 *   1) CALIBRAÇÃO — moldura de 800×800 + ticks de canto + régua. Mostra onde o
 *      print cai em relação à borda física do papel. Conte os ticks que sumiram
 *      na esquerda → cada tick = 1mm (8 dots) → esse é o valor pra ajustar MARGEM_ESQ.
 *   2) PRODUTO COMPLETO — Bolo de Cenoura com todos os campos preenchidos.
 *   3) PRODUTO ENXUTO — só info nutricional (testa a tabela "elástica" preenchendo a etiqueta).
 *
 * Pra mandar pra impressora da Madre Pane (no PC dela): copie o conteúdo do .zpl
 * e jogue na impressora (ex.: `curl -X POST http://localhost:9101/print -H 'Content-Type: text/plain' --data-binary @docs/teste-rotulo-100x100.zpl`),
 * ou cole no utilitário ZPL. A impressora precisa estar em modo PPLZ/ZPL.
 */
import { writeFileSync } from 'node:fs';
import { generateEtiquetaZplRotulo, type RotuloItem } from '../src/lib/etiqueta-zpl';
import { LOGO_MADRE_PANE } from '../src/lib/etiqueta-logos';

// --- 1) etiqueta de calibração ----------------------------------------------
function calibracaoZpl(): string {
  const o: string[] = ['^XA', '^CI28', '^PW800', '^LL800', '^LH0,0'];
  // moldura externa
  o.push('^FO0,0^GB800,800,3,B,0^FS');
  o.push('^FO20,20^GB760,760,1,B,0^FS');
  // régua horizontal no topo: tick a cada 1mm (8 dots), tick maior a cada 10mm
  for (let mm = 0; mm <= 100; mm++) {
    const x = mm * 8;
    const h = mm % 10 === 0 ? 30 : mm % 5 === 0 ? 18 : 10;
    o.push(`^FO${x},0^GB1,${h},1^FS`);
    if (mm % 10 === 0 && mm > 0 && mm < 100) o.push(`^FO${x - 8},34^A0N,16,16^FD${mm}^FS`);
  }
  // régua vertical na esquerda
  for (let mm = 0; mm <= 100; mm++) {
    const y = mm * 8;
    const w = mm % 10 === 0 ? 30 : mm % 5 === 0 ? 18 : 10;
    o.push(`^FO0,${y}^GB${w},1,1^FS`);
  }
  o.push('^FO120,360^A0N,40,40^FDCALIBRACAO^FS');
  o.push('^FO120,410^A0N,24,24^FDConte os tracos que sumiram^FS');
  o.push('^FO120,440^A0N,24,24^FDna ESQUERDA: cada um = 1mm.^FS');
  o.push('^FO120,470^A0N,24,24^FDEsse e o ajuste de MARGEM_ESQ.^FS');
  o.push('^XZ');
  return o.join('\n');
}

// --- 2) produto completo ----------------------------------------------------
const produtoCompleto: RotuloItem = {
  produtoNome: 'Bolo de Cenoura com Cobertura de Chocolate',
  ean13: null, // ex.: '7891234567895' pra ver o código de barras
  ingredientes:
    'Farinha de trigo enriquecida com ferro e ácido fólico, açúcar, cenoura, ovos, óleo de soja, ' +
    'cobertura sabor chocolate (açúcar, gordura vegetal, cacau em pó, leite em pó), fermento químico, sal, ' +
    'aroma idêntico ao natural de baunilha.',
  alergicos: 'ALÉRGICOS: CONTÉM TRIGO, OVOS E DERIVADOS DE LEITE. PODE CONTER CASTANHAS.',
  modoPreparo: 'Produto pronto para consumo.',
  modoConservacao:
    'Conservar em local fresco e seco, ao abrigo de luz. Após aberto, manter refrigerado e consumir em até 3 dias.',
  porcaoTexto: 'Porções por embalagem: 8 · Porção: 230 g (1 fatia)',
  porcaoColunaTexto: '230 g',
  logo: LOGO_MADRE_PANE,
  valoresPor100: {
    unidadeBase: 'g',
    porcaoG: 230,
    porcoesEmbalagem: 8,
    porcaoMedidaCaseira: '1 fatia',
    categoriaRDC429: 'SOLIDO',
    valorEnergeticoKcal100: 230,
    carboidratosG100: 34,
    acucaresTotaisG100: 20,
    acucaresAdicionadosG100: 17,
    proteinasG100: 3,
    gordurasTotaisG100: 9,
    gordurasSaturadasG100: 2,
    gordurasTransG100: 0,
    fibrasG100: 1,
    sodioMg100: 120,
  },
  fabricante: {
    razaoSocial: 'Madre Pane Panificadora e Confeitaria Ltda',
    cnpj: '61.724.756/0001-78',
    inscricaoEstadual: '20.123.456-7',
    endereco: null,
    logradouro: 'Av. Senador Salgado Filho',
    numero: '1234',
    complemento: 'Loja 2',
    bairro: 'Lagoa Nova',
    municipio: 'Natal',
    uf: 'RN',
    cep: '59056-000',
    telefone: '(84) 3000-0000',
  },
  lote: { lote: '01', fabricacao: '12/05/2026', conteudoLiquido: '6 UNI' },
};

// --- 3) produto enxuto (só nutrição) ----------------------------------------
const produtoEnxuto: RotuloItem = {
  ...produtoCompleto,
  produtoNome: 'Pão Francês',
  ean13: null,
  ingredientes: null,
  alergicos: null,
  modoPreparo: null,
  modoConservacao: null,
  porcaoTexto: 'Porções por embalagem: 10 · Porção: 50 g (1 unidade)',
  porcaoColunaTexto: '50 g',
  valoresPor100: {
    ...produtoCompleto.valoresPor100,
    porcaoG: 50,
    porcoesEmbalagem: 10,
    porcaoMedidaCaseira: '1 unidade',
    valorEnergeticoKcal100: 300,
    carboidratosG100: 58,
    acucaresTotaisG100: 2,
    acucaresAdicionadosG100: 1,
    proteinasG100: 9,
    gordurasTotaisG100: 3,
    gordurasSaturadasG100: 1,
    gordurasTransG100: 0,
    fibrasG100: 2,
    sodioMg100: 580,
  },
  lote: { lote: 'L0512', fabricacao: '12/05/2026', conteudoLiquido: '10 UNI' },
};

const zpl = [
  calibracaoZpl(),
  generateEtiquetaZplRotulo(produtoCompleto),
  generateEtiquetaZplRotulo(produtoEnxuto),
].join('\n');

const out = process.argv[2] ?? 'docs/teste-rotulo-100x100.zpl';
writeFileSync(out, zpl + '\n');
console.error(`escrito ${out} — ${Buffer.byteLength(zpl)} bytes, 3 etiquetas`);
