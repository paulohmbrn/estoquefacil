// Forma exata de cada item no dump ZmartBI (validado contra
// /tmp/zmart_full.json — 286.748 itens, 22 filiais, 21 campos, 0% nulos).

export type ZmartbiItem = {
  _id: string;
  NRORG: number;
  CDEMPRESA: string;
  CDFILIAL: string;             // 4 chars — chave da loja
  NMFILIAL: string;
  DATA: string;                 // DD/MM/AAAA — data do snapshot
  CDPRODUTO: string;
  NMPRODUTO: string;
  CDARVPROD: string;            // 11 (agrupador) ou 13 (SKU contável)
  UNIDADE?: string;             // 100% preenchida quando CDARVPROD.length === 13
  CD_BARRA?: string;            // EAN-13/EAN-8/Code 128 do produto (opcional)
  CD_TIPO_PRODUTO: string;
  TIPO_PRODUTO: string;
  CDGRUPPROD: string;
  NMGRUPPROD: string;
  CDSUBGRPROD: string;
  NMSUBGRPROD: string;
  STATUS: 'S' | 'N';
  COMPOE_CMV: 'S' | 'N';
  VRPRECO_VENDA: number;
  DT_CADASTRO: string;          // DD/MM/AAAA
  DT_ALTERACAO: string;         // DD/MM/AAAA
};
