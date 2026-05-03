// POST /api/cert/upload — upload de certificado A1 (.pfx) por loja.
// Recebe via multipart/form-data (mais robusto que Server Action pra arquivos):
//   - lojaId
//   - senha
//   - cert (File pfx/p12)
// Valida com node-forge, cifra a senha (AES-256-GCM) e salva em /secrets.

import { NextResponse, type NextRequest } from 'next/server';
import * as forge from 'node-forge';
import { encryptString } from '@estoque/shared';
import { prisma } from '@/lib/db';
import { requireGestor } from '@/lib/permissions';
import { saveCert } from '@/lib/cert-storage';
import { extractCnpjFromCert as extractCnpjFromCertShared, compareCnpjs, formatCnpj as formatCnpjShared } from '@/lib/cert-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const fd = await req.formData();
    const lojaId = String(fd.get('lojaId') ?? '').trim();
    const senha = String(fd.get('senha') ?? '');
    const certEntry = fd.get('cert');

    if (!lojaId) return NextResponse.json({ ok: false, error: 'lojaId obrigatório' }, { status: 400 });
    if (!senha) return NextResponse.json({ ok: false, error: 'senha obrigatória' }, { status: 400 });
    if (!(certEntry instanceof File)) {
      return NextResponse.json({ ok: false, error: 'arquivo .pfx obrigatório' }, { status: 400 });
    }

    await requireGestor({ lojaId });

    const loja = await prisma.loja.findUnique({
      where: { id: lojaId },
      select: { zmartbiId: true, cnpj: true, nome: true },
    });
    if (!loja) return NextResponse.json({ ok: false, error: 'Loja não encontrada' }, { status: 404 });
    if (!loja.cnpj || loja.cnpj.length !== 14) {
      return NextResponse.json(
        { ok: false, error: 'Loja sem CNPJ cadastrado (14 dígitos). Cadastre o CNPJ antes de subir o certificado.' },
        { status: 400 },
      );
    }
    const aceitarBaseDiferente = String(fd.get('aceitarBaseDiferente') ?? '') === '1';

    const arrayBuf = await certEntry.arrayBuffer();
    const pfxBuffer = Buffer.from(arrayBuf);
    if (pfxBuffer.length < 200) {
      return NextResponse.json({ ok: false, error: 'Arquivo .pfx muito pequeno — provavelmente corrompido' }, { status: 400 });
    }
    if (pfxBuffer.length > 200_000) {
      // PFX > 200KB é suspeito (típico A1 = 5-15KB)
      return NextResponse.json({ ok: false, error: 'Arquivo .pfx muito grande (>200KB) — verifique se é A1 válido' }, { status: 400 });
    }

    let nome = '';
    let validoAte = new Date(0);
    let certCnpj: string | null = null;
    try {
      const der = forge.util.createBuffer(pfxBuffer.toString('binary'));
      const asn1 = forge.asn1.fromDer(der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
      let cert: forge.pki.Certificate | null = null;
      for (const sc of p12.safeContents) {
        for (const sb of sc.safeBags) {
          if (sb.cert) { cert = sb.cert; break; }
        }
        if (cert) break;
      }
      if (!cert) {
        return NextResponse.json({ ok: false, error: 'Não achei certificado X509 dentro do PFX' }, { status: 400 });
      }
      const cn = cert.subject.getField('CN');
      nome = cn?.value ?? '';
      validoAte = cert.validity.notAfter;
      if (validoAte.getTime() < Date.now()) {
        return NextResponse.json(
          { ok: false, error: `Certificado vencido em ${validoAte.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` },
          { status: 400 },
        );
      }
      certCnpj = extractCnpjFromCertShared(cert, nome);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      // eslint-disable-next-line no-console
      console.error('[cert/upload] node-forge falhou:', msg);
      if (/MAC|password|invalid/i.test(msg)) {
        return NextResponse.json({ ok: false, error: 'Senha do certificado incorreta.' }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: `Falha ao validar PFX: ${msg}` }, { status: 400 });
    }

    // Validação CNPJ certificado × CNPJ da loja
    if (!certCnpj) {
      return NextResponse.json(
        { ok: false, error: `Não consegui extrair o CNPJ do certificado. CN: "${nome}". Esperado formato ICP-Brasil "RAZAO:CNPJ" ou OID 2.16.76.1.3.4.` },
        { status: 400 },
      );
    }
    const cmp = compareCnpjs(loja.cnpj, certCnpj, loja.nome);
    let avisoCnpj: string | null = null;
    if (cmp.kind === 'mesma-base') {
      avisoCnpj = cmp.aviso;
    } else if (cmp.kind === 'base-diferente') {
      if (!aceitarBaseDiferente) {
        return NextResponse.json(
          {
            ok: false,
            requireConfirmCnpjBase: true,
            cnpjLoja: loja.cnpj,
            cnpjCert: certCnpj,
            error: `CNPJ do certificado (${formatCnpjShared(certCnpj)}) é de empresa diferente da cadastrada na loja "${loja.nome}" (${formatCnpjShared(loja.cnpj)}). Bases ${cmp.baseCert} ≠ ${cmp.baseLoja} — SEFAZ vai recusar. Reenvie com aceitarBaseDiferente=1 se quiser forçar.`,
          },
          { status: 400 },
        );
      }
      avisoCnpj = `Forçado: CNPJ do certificado (${formatCnpjShared(certCnpj)}) é de empresa diferente. SEFAZ pode rejeitar.`;
    }

    let senhaEnc: string;
    try {
      senhaEnc = encryptString(senha);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[cert/upload] encryptString falhou:', err);
      return NextResponse.json(
        { ok: false, error: `Falha ao cifrar senha (ENCRYPTION_KEY?): ${(err as Error).message}` },
        { status: 500 },
      );
    }

    let certPath: string;
    try {
      certPath = await saveCert(loja.zmartbiId, pfxBuffer);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[cert/upload] saveCert falhou:', err);
      return NextResponse.json(
        { ok: false, error: `Falha ao salvar arquivo: ${(err as Error).message}` },
        { status: 500 },
      );
    }

    await prisma.loja.update({
      where: { id: lojaId },
      data: {
        certificadoPath: certPath,
        certificadoSenhaEnc: senhaEnc,
        certificadoNome: nome,
        certificadoValidoAte: validoAte,
        certificadoUploadedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      data: { nome, validoAte: validoAte.toISOString(), cnpjCert: certCnpj, avisoCnpj },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[cert/upload] erro inesperado:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? 'Erro interno' },
      { status: 500 },
    );
  }
}

