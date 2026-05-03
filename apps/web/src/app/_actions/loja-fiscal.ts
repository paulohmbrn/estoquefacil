'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as forge from 'node-forge';
import { encryptString } from '@estoque/shared';
import { prisma } from '@/lib/db';
import { requireGestor } from '@/lib/permissions';
import { saveCert, deleteCert } from '@/lib/cert-storage';
import { extractCnpjFromCert, compareCnpjs, formatCnpj } from '@/lib/cert-validation';

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; requireConfirmCnpjBase?: boolean; cnpjLoja?: string; cnpjCert?: string };

const fiscalSchema = z.object({
  lojaId: z.string().min(1),
  cnpj: z
    .string()
    .transform((s) => s.replace(/\D/g, ''))
    .refine((s) => s.length === 14 || s === '', { message: 'CNPJ deve ter 14 dígitos' }),
  inscricaoEstadual: z.string().optional().nullable(),
  ufFiscal: z.string().length(2).optional().nullable(),
});

export async function updateLojaFiscal(input: z.infer<typeof fiscalSchema>): Promise<ActionResult> {
  try {
    const parsed = fiscalSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    await requireGestor({ lojaId: parsed.data.lojaId });
    await prisma.loja.update({
      where: { id: parsed.data.lojaId },
      data: {
        cnpj: parsed.data.cnpj || null,
        inscricaoEstadual: parsed.data.inscricaoEstadual?.trim() || null,
        ufFiscal: parsed.data.ufFiscal?.toUpperCase() || null,
      },
    });
    revalidatePath('/cadastros/lojas');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const certSchema = z.object({
  lojaId: z.string().min(1),
  pfxBase64: z.string().min(100), // pfx é binário grande
  senha: z.string().min(1),
  /** Se true, ignora a divergência de base CNPJ entre cert e loja (uso administrativo). */
  aceitarBaseDiferente: z.boolean().optional().default(false),
});

/** Faz upload + valida o certificado PFX, valida CNPJ vs loja, salva no filesystem e cifra a senha. */
export async function uploadCertificado(
  input: z.infer<typeof certSchema>,
): Promise<ActionResult<{ validoAte: string; nome: string; cnpjCert: string; avisoCnpj: string | null }>> {
  try {
    const parsed = certSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    await requireGestor({ lojaId: parsed.data.lojaId });

    const loja = await prisma.loja.findUnique({
      where: { id: parsed.data.lojaId },
      select: { zmartbiId: true, cnpj: true, nome: true },
    });
    if (!loja) return { ok: false, error: 'Loja não encontrada' };
    if (!loja.cnpj || loja.cnpj.length !== 14) {
      return { ok: false, error: 'Loja sem CNPJ cadastrado (14 dígitos). Cadastre o CNPJ antes de subir o certificado.' };
    }

    // Decode base64 (data:application/x-pkcs12;base64,XXXX ou só XXXX)
    const b64 = parsed.data.pfxBase64.replace(/^data:[^,]+,/, '');
    let pfxBuffer: Buffer;
    try {
      pfxBuffer = Buffer.from(b64, 'base64');
    } catch {
      return { ok: false, error: 'Arquivo .pfx inválido (não é base64)' };
    }
    if (pfxBuffer.length < 200) {
      return { ok: false, error: 'Arquivo .pfx muito pequeno — provavelmente corrompido' };
    }

    // Valida que abre com a senha + extrai nome+validade+cnpj
    let nome = '';
    let validoAte = new Date(0);
    let cnpjCert: string | null = null;
    try {
      const der = forge.util.createBuffer(pfxBuffer.toString('binary'));
      const asn1 = forge.asn1.fromDer(der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, parsed.data.senha);
      let cert: forge.pki.Certificate | null = null;
      for (const sc of p12.safeContents) {
        for (const sb of sc.safeBags) {
          if (sb.cert) { cert = sb.cert; break; }
        }
        if (cert) break;
      }
      if (!cert) return { ok: false, error: 'Não achei certificado X509 dentro do PFX' };
      const cn = cert.subject.getField('CN');
      nome = cn?.value ?? '';
      validoAte = cert.validity.notAfter;
      if (validoAte.getTime() < Date.now()) {
        return { ok: false, error: `Certificado vencido em ${validoAte.toLocaleDateString('pt-BR')}` };
      }
      cnpjCert = extractCnpjFromCert(cert, nome);
    } catch (err) {
      const msg = (err as Error).message;
      if (/MAC/i.test(msg) || /invalid password/i.test(msg)) {
        return { ok: false, error: 'Senha do certificado incorreta.' };
      }
      return { ok: false, error: `Falha ao validar PFX: ${msg}` };
    }

    if (!cnpjCert) {
      return {
        ok: false,
        error: `Não consegui extrair o CNPJ do certificado. CN: "${nome}". Esperado formato ICP-Brasil "RAZAO:CNPJ".`,
      };
    }

    const cmp = compareCnpjs(loja.cnpj, cnpjCert, loja.nome);
    let avisoCnpj: string | null = null;
    if (cmp.kind === 'mesma-base') {
      avisoCnpj = cmp.aviso;
    } else if (cmp.kind === 'base-diferente') {
      if (!parsed.data.aceitarBaseDiferente) {
        return {
          ok: false,
          requireConfirmCnpjBase: true,
          cnpjLoja: loja.cnpj,
          cnpjCert,
          error: `CNPJ do certificado (${formatCnpj(cnpjCert)}) é de uma empresa diferente da cadastrada na loja "${loja.nome}" (${formatCnpj(loja.cnpj)}). Bases ${cmp.baseCert} ≠ ${cmp.baseLoja} — a SEFAZ vai rejeitar consultas. Se mesmo assim quer continuar, marque "aceitar mesmo assim" e reenvie.`,
        };
      }
      avisoCnpj = `Forçado: CNPJ do certificado (${formatCnpj(cnpjCert)}) é de empresa diferente. SEFAZ pode rejeitar.`;
    }

    // Salva no filesystem + cifra senha
    let senhaEnc: string;
    try {
      senhaEnc = encryptString(parsed.data.senha);
    } catch (err) {
      return { ok: false, error: `Falha ao cifrar senha: ${(err as Error).message}` };
    }
    const certPath = await saveCert(loja.zmartbiId, pfxBuffer);
    await prisma.loja.update({
      where: { id: parsed.data.lojaId },
      data: {
        certificadoPath: certPath,
        certificadoSenhaEnc: senhaEnc,
        certificadoNome: nome,
        certificadoValidoAte: validoAte,
        certificadoUploadedAt: new Date(),
      },
    });
    revalidatePath('/cadastros/lojas');
    return {
      ok: true,
      data: { validoAte: validoAte.toISOString(), nome, cnpjCert, avisoCnpj },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removerCertificado(lojaId: string): Promise<ActionResult> {
  try {
    await requireGestor({ lojaId });
    const loja = await prisma.loja.findUnique({ where: { id: lojaId }, select: { zmartbiId: true } });
    if (loja) await deleteCert(loja.zmartbiId);
    await prisma.loja.update({
      where: { id: lojaId },
      data: {
        certificadoPath: null,
        certificadoSenhaEnc: null,
        certificadoNome: null,
        certificadoValidoAte: null,
        certificadoUploadedAt: null,
      },
    });
    revalidatePath('/cadastros/lojas');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
