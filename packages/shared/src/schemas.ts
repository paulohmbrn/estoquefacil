import { z } from 'zod';

// CDARVPROD de SKU contável: 13 chars numéricos
export const cdarvprodSchema = z
  .string()
  .regex(/^\d{13}$/, 'CDARVPROD deve ter 13 dígitos numéricos');

// CDFILIAL: 4 chars numéricos
export const cdFilialSchema = z.string().regex(/^\d{4}$/, 'CDFILIAL deve ter 4 dígitos');

// E-mail dentro do(s) domínio(s) whitelist. Aceita string única (legado) ou lista.
export function emailDomainSchema(allowed: string | readonly string[]): z.ZodSchema<string> {
  const list = (Array.isArray(allowed) ? allowed : [allowed]).map((d) => d.toLowerCase());
  return z
    .string()
    .email()
    .refine(
      (email) => {
        const lower = email.toLowerCase();
        return list.some((d) => lower.endsWith(`@${d}`));
      },
      { message: `E-mail precisa terminar em ${list.map((d) => `@${d}`).join(' ou ')}` },
    );
}

// Quantidade do lançamento (até 3 casas decimais, >= 0)
export const quantidadeSchema = z
  .number({ invalid_type_error: 'quantidade deve ser numérica' })
  .min(0, 'quantidade não pode ser negativa')
  .multipleOf(0.001, 'até 3 casas decimais');

// Data como ISO yyyy-mm-dd
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data ISO yyyy-mm-dd');
