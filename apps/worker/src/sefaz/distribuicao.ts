// Cliente SOAP NFeDistribuicaoDFe — endpoint nacional da RFB.
// Assina envelope com certificado A1 (PFX) e descompacta os docZip retornados.

import { gunzipSync } from 'node:zlib';
import https from 'node:https';
import { Buffer } from 'node:buffer';
import { XMLParser } from 'fast-xml-parser';

const SEFAZ_URL = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const SEFAZ_NS = 'http://www.portalfiscal.inf.br/nfe';
const ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
const TP_AMB = '1'; // 1=produção, 2=homologação

// Tabela de cUF (IBGE) por sigla — usado em <cUFAutor>
const CUF_BY_UF: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15', PB: '25', PR: '41',
  PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17',
};

interface DistRequest {
  uf: string;
  cnpj: string;       // 14 dígitos
  ultNSU: string;     // ex "0", "000000000000123"
  pfx: Buffer;
  senha: string;
}

export interface DistDoc {
  nsu: string;
  schema: string;     // ex "procNFe_v4.00.xsd"
  xml: string;        // XML descompactado
}

export interface DistResponse {
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  docs: DistDoc[];
}

function buildEnvelope(args: { cUF: string; cnpj: string; ultNSU: string }): string {
  // ultNSU precisa de 15 dígitos zero-padded
  const ult = args.ultNSU.padStart(15, '0');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt versao="1.01" xmlns="${SEFAZ_NS}">
          <tpAmb>${TP_AMB}</tpAmb>
          <cUFAutor>${args.cUF}</cUFAutor>
          <CNPJ>${args.cnpj}</CNPJ>
          <distNSU><ultNSU>${ult}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;
}

function postSoap(envelope: string, pfx: Buffer, senha: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(SEFAZ_URL);
    const options: https.RequestOptions = {
      method: 'POST',
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': `application/soap+xml; charset=UTF-8; action="${ACTION}"`,
        'Content-Length': Buffer.byteLength(envelope),
      },
      pfx,
      passphrase: senha,
      // Não rejeita NewCa Receita — exigência reconhecida; em produção mantemos true
      rejectUnauthorized: true,
    };
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${body.slice(0, 400)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(envelope);
    req.end();
  });
}

export async function consultarDistribuicaoDFe(req: DistRequest): Promise<DistResponse> {
  const cUF = CUF_BY_UF[req.uf.toUpperCase()];
  if (!cUF) throw new Error(`UF inválida: ${req.uf}`);
  const envelope = buildEnvelope({ cUF, cnpj: req.cnpj, ultNSU: req.ultNSU });
  const responseXml = await postSoap(envelope, req.pfx, req.senha);

  // Parse SOAP envelope
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
  });
  const parsed = parser.parse(responseXml) as Record<string, unknown>;
  const retDistDFeInt = findKey(parsed, 'retDistDFeInt') as Record<string, unknown> | null;
  if (!retDistDFeInt) {
    throw new Error('Resposta SEFAZ sem retDistDFeInt: ' + responseXml.slice(0, 400));
  }

  const cStat = String(retDistDFeInt.cStat ?? '');
  const xMotivo = String(retDistDFeInt.xMotivo ?? '');
  const ultNSU = String(retDistDFeInt.ultNSU ?? req.ultNSU);
  const maxNSU = String(retDistDFeInt.maxNSU ?? req.ultNSU);

  const lote = retDistDFeInt.loteDistDFeInt as Record<string, unknown> | undefined;
  const docZipRaw = lote?.docZip as unknown;
  const docArr: Array<Record<string, unknown>> = !docZipRaw
    ? []
    : Array.isArray(docZipRaw)
    ? (docZipRaw as Array<Record<string, unknown>>)
    : [docZipRaw as Record<string, unknown>];

  const docs: DistDoc[] = docArr.map((d) => {
    const nsu = String(d['@_NSU'] ?? '');
    const schema = String(d['@_schema'] ?? '');
    const b64 = String(d['#text'] ?? '');
    let xml = '';
    try {
      const gz = Buffer.from(b64, 'base64');
      xml = gunzipSync(gz).toString('utf8');
    } catch (err) {
      // doc com erro de descompressão — retorna xml vazio mas mantém o nsu/schema pra log
      xml = `<!-- erro descompressão: ${(err as Error).message} -->`;
    }
    return { nsu, schema, xml };
  });

  return { cStat, xMotivo, ultNSU, maxNSU, docs };
}

// ============================================================
// Parser de NFe completa (procNFe)
// ============================================================

export interface NfeMeta {
  chaveAcesso: string;
  numeroNf: string;
  serieNf: string;
  modelo: string;
  emissorCnpj: string;
  emissorNome: string;
  destCnpj: string;
  dataEmissao: Date | null;
  dataAutorizacao: Date | null;
  valorTotal: number;
  qtdItens: number;
}

export interface NfeItem {
  cProd: string;
  cEAN?: string;
  xProd: string;
  uCom: string;
  qCom: number;
  vProd: number;
}

export function parseNfeXml(xml: string): { meta: NfeMeta; itens: NfeItem[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
  });
  const obj = parser.parse(xml) as Record<string, unknown>;
  const infNFe = findKey(obj, 'infNFe') as Record<string, unknown> | null;
  if (!infNFe) throw new Error('infNFe não encontrado no XML');

  const idAttr = String(infNFe['@_Id'] ?? '');
  const chave = idAttr.replace(/^NFe/, '');

  const ide = (infNFe.ide ?? {}) as Record<string, unknown>;
  const emit = (infNFe.emit ?? {}) as Record<string, unknown>;
  const dest = (infNFe.dest ?? {}) as Record<string, unknown>;
  const total = ((infNFe.total ?? {}) as Record<string, unknown>).ICMSTot as Record<string, unknown> | undefined;
  const protNFe = findKey(obj, 'protNFe') as Record<string, unknown> | null;
  const infProt = protNFe?.infProt as Record<string, unknown> | undefined;

  const det = infNFe.det as unknown;
  const detArr: Array<Record<string, unknown>> = Array.isArray(det)
    ? (det as Array<Record<string, unknown>>)
    : det
    ? [det as Record<string, unknown>]
    : [];

  const itens: NfeItem[] = detArr.map((d) => {
    const prod = (d.prod ?? {}) as Record<string, unknown>;
    return {
      cProd: String(prod.cProd ?? ''),
      cEAN: String(prod.cEAN ?? '') || undefined,
      xProd: String(prod.xProd ?? ''),
      uCom: String(prod.uCom ?? ''),
      qCom: Number(String(prod.qCom ?? '0').replace(',', '.')) || 0,
      vProd: Number(String(prod.vProd ?? '0').replace(',', '.')) || 0,
    };
  });

  const meta: NfeMeta = {
    chaveAcesso: chave,
    numeroNf: String(ide.nNF ?? ''),
    serieNf: String(ide.serie ?? ''),
    modelo: String(ide.mod ?? ''),
    emissorCnpj: String(emit.CNPJ ?? '').replace(/\D/g, ''),
    emissorNome: String(emit.xNome ?? ''),
    destCnpj: String(dest.CNPJ ?? dest.CPF ?? '').replace(/\D/g, ''),
    dataEmissao: parseSefazDate(String(ide.dhEmi ?? '')),
    dataAutorizacao: parseSefazDate(String(infProt?.dhRecbto ?? '')),
    valorTotal: Number(String(total?.vNF ?? '0').replace(',', '.')) || 0,
    qtdItens: itens.length,
  };

  return { meta, itens };
}

/** Parse do XML <resNFe> (resumo de NFe) — não tem itens, só metadados básicos.
 *  Útil porque a SEFAZ entrega resNFe quando o destinatário ainda não baixou
 *  o procNFe completo. Mesmo sem itens, dá pra mostrar fornecedor/valor na lista. */
export function parseResNfeXml(xml: string): {
  chaveAcesso: string;
  emissorCnpj: string;
  emissorNome: string;
  dataEmissao: Date | null;
  valorTotal: number;
} | null {
  const chave = xml.match(/<chNFe>(\d{44})<\/chNFe>/)?.[1];
  if (!chave) return null;
  const cnpj = xml.match(/<CNPJ>(\d{14})<\/CNPJ>/)?.[1] ?? '';
  const nome = xml.match(/<xNome>([^<]+)<\/xNome>/)?.[1] ?? '';
  const dhEmi = xml.match(/<dhEmi>([^<]+)<\/dhEmi>/)?.[1];
  const vNF = xml.match(/<vNF>([^<]+)<\/vNF>/)?.[1];
  return {
    chaveAcesso: chave,
    emissorCnpj: cnpj,
    emissorNome: nome,
    dataEmissao: dhEmi ? parseSefazDate(dhEmi) : null,
    valorTotal: vNF ? Number(vNF.replace(',', '.')) : 0,
  };
}

function parseSefazDate(s: string): Date | null {
  if (!s) return null;
  // SEFAZ usa ISO 8601 com timezone (ex 2026-04-30T10:15:00-03:00)
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function findKey(obj: unknown, target: string): unknown {
  if (obj === null || typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === target) return v;
    const sub = findKey(v, target);
    if (sub) return sub;
  }
  return null;
}
