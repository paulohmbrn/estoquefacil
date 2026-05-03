'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireGestor, requireUser } from '@/lib/permissions';
import { emailDomainSchema } from '@estoque/shared';

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'reismagos.com.br';

const baseSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  email: z
    .string()
    .optional()
    .transform((v) => (v ? v.toLowerCase().trim() : undefined)),
  telefone: z.string().optional(),
  cargo: z.string().optional(),
  permissao: z.enum(['SEM_LOGIN', 'COM_LOGIN', 'GESTOR']).default('SEM_LOGIN'),
  lojaId: z.string().min(1, 'Loja obrigatória'),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

function validateEmail(email: string | undefined, permissao: string): string | null {
  if (permissao === 'SEM_LOGIN') return null;
  if (!email) return 'E-mail é obrigatório quando o funcionário tem login.';
  const r = emailDomainSchema(ALLOWED_DOMAIN).safeParse(email);
  if (!r.success) return r.error.issues[0]!.message;
  return null;
}

export async function createFuncionario(formData: FormData): Promise<ActionResult> {
  try {
    const lojaId = String(formData.get('lojaId') ?? '');
    await requireGestor({ lojaId });

    const parsed = baseSchema.safeParse({
      nome: formData.get('nome'),
      email: formData.get('email') ?? undefined,
      telefone: formData.get('telefone') ?? undefined,
      cargo: formData.get('cargo') ?? undefined,
      permissao: formData.get('permissao') ?? 'SEM_LOGIN',
      lojaId,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]!.message };
    }
    const data = parsed.data;
    const emailErr = validateEmail(data.email, data.permissao);
    if (emailErr) return { ok: false, error: emailErr };

    // Se vinculou e-mail, busca/cria User correspondente.
    let userId: string | null = null;
    if (data.email) {
      const user = await prisma.user.upsert({
        where: { email: data.email },
        update: { name: data.nome },
        create: { email: data.email, name: data.nome },
      });
      userId = user.id;
    }

    const funcionario = await prisma.funcionario.create({
      data: {
        nome: data.nome,
        email: data.email ?? null,
        telefone: data.telefone || null,
        cargo: data.cargo || null,
        permissao: data.permissao,
        lojaId: data.lojaId,
        userId,
      },
    });

    // Vínculo de loja para usuários com login (papel deriva da permissão).
    if (userId && data.permissao !== 'SEM_LOGIN') {
      const papel = data.permissao === 'GESTOR' ? 'GESTOR' : 'OPERADOR';
      await prisma.usuarioLoja.upsert({
        where: { userId_lojaId: { userId, lojaId: data.lojaId } },
        update: { papel, ativo: true },
        create: { userId, lojaId: data.lojaId, papel, ativo: true },
      });
    }

    revalidatePath('/cadastros/funcionarios');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleFuncionarioAtivo(funcionarioId: string): Promise<ActionResult> {
  try {
    const f = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: { id: true, lojaId: true, ativo: true, userId: true },
    });
    if (!f) return { ok: false, error: 'Funcionário não encontrado' };
    await requireGestor({ lojaId: f.lojaId });
    await prisma.$transaction(async (tx) => {
      await tx.funcionario.update({ where: { id: funcionarioId }, data: { ativo: !f.ativo } });
      if (f.userId) {
        await tx.usuarioLoja.updateMany({
          where: { userId: f.userId, lojaId: f.lojaId },
          data: { ativo: !f.ativo },
        });
      }
    });
    revalidatePath('/cadastros/funcionarios');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Promove o User logado a Gestor da loja indicada.
 * Política atual: qualquer usuário autenticado (login Google já passou pelo
 * whitelist @reismagos.com.br) pode reclamar Gestor de qualquer loja MVP —
 * múltiplos gestores por unidade são suportados. Idempotente: se já é
 * gestor da loja, não duplica. */
export async function selfBootstrapGestor(lojaId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await prisma.usuarioLoja.upsert({
      where: { userId_lojaId: { userId: user.id, lojaId } },
      update: { papel: 'GESTOR', ativo: true },
      create: { userId: user.id, lojaId, papel: 'GESTOR', ativo: true },
    });
    revalidatePath('/');
    revalidatePath('/onboarding/lojas');
    revalidatePath('/cadastros/funcionarios');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
