// Formatadores padrão pra exibir datas/horas em BRT (São Paulo) — independente
// do timezone do servidor (que roda em UTC no container). Use em qualquer
// lugar que mostra horário pro usuário final.

const TZ = 'America/Sao_Paulo';

/** Data + hora completas (ex.: "03/05/2026 14:32"). */
export const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: TZ,
});

/** Apenas data (ex.: "03/05/2026") em BRT — para timestamps com hora. */
export const fmtData = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: TZ,
});

/** Apenas data, mas sem aplicar offset BRT — para campos que vêm como
 *  "DD/MM/AAAA" puro do ZmartBI (Date à meia-noite UTC). Evita off-by-one. */
export const fmtDataNoTz = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'UTC',
});

/** Apenas hora (ex.: "14:32") em BRT. */
export const fmtHora = new Intl.DateTimeFormat('pt-BR', {
  timeStyle: 'short',
  timeZone: TZ,
});

/** Data por extenso (ex.: "domingo, 03 de maio de 2026") em BRT. */
export const fmtDataExtenso = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
});
