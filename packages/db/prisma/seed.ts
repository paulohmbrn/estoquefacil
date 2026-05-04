import { PrismaClient } from '@prisma/client';

// As filiais do MVP — confirmado por Paulo (2026-05-01).
// Mapeamento extraído do dump real do ZmartBI (286.748 itens, 22 filiais).
// FFB ALIMENTOS (0013) adicionada em 2026-05-04 — fábrica, vê prefixos 1* e 2*.
type LojaSeed = {
  zmartbiId: string;
  nome: string;
  apelido: string;
  cnpj?: string;
};
const LOJAS_MVP: readonly LojaSeed[] = [
  { zmartbiId: '0001', nome: 'REIS MAGOS - CAPIM MACIO',     apelido: 'Capim Macio' },
  { zmartbiId: '0003', nome: 'REIS MAGOS - CANDELARIA',      apelido: 'Candelária' },
  { zmartbiId: '0004', nome: 'REIS MAGOS - NOVA PARNAMIRIM', apelido: 'Nova Parnamirim' },
  { zmartbiId: '0005', nome: 'REIS MAGOS - LAGOA NOVA',      apelido: 'Lagoa Nova' },
  { zmartbiId: '0006', nome: 'REIS MAGOS - MIDWAY MALL',     apelido: 'Midway Mall' },
  { zmartbiId: '0008', nome: 'REIS MAGOS - PETROPOLIS',      apelido: 'Petrópolis' },
  { zmartbiId: '0013', nome: 'FFB ALIMENTOS',                apelido: 'FFB Alimentos', cnpj: '27732926000128' },
  { zmartbiId: '0016', nome: 'REIS MAGOS - VILA MARIANA',    apelido: 'Vila Mariana' },
  { zmartbiId: '0017', nome: 'REIS MAGOS - NORTE SHOPPING',  apelido: 'Norte Shopping' },
  { zmartbiId: '0019', nome: 'REIS MAGOS - COOPHAB',         apelido: 'Coophab' },
  { zmartbiId: '0023', nome: 'MADRE PANE - LAGOA NOVA',      apelido: 'Madre Pane Lagoa Nova' },
];

const NRORG = 1148;
const CD_EMPRESA = '01';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    let inserted = 0;
    let updated = 0;
    for (const loja of LOJAS_MVP) {
      const existing = await prisma.loja.findUnique({ where: { zmartbiId: loja.zmartbiId } });
      // CNPJ só entra no payload quando vier do seed — evita sobrescrever
      // CNPJ que o gestor já editou via UI nas outras lojas.
      const data: {
        zmartbiId: string;
        nrOrg: number;
        cdEmpresa: string;
        nome: string;
        apelido: string;
        ativo: boolean;
        cnpj?: string;
      } = {
        zmartbiId: loja.zmartbiId,
        nrOrg: NRORG,
        cdEmpresa: CD_EMPRESA,
        nome: loja.nome,
        apelido: loja.apelido,
        ativo: true,
      };
      if (loja.cnpj) data.cnpj = loja.cnpj;
      if (existing) {
        await prisma.loja.update({ where: { zmartbiId: loja.zmartbiId }, data });
        updated += 1;
      } else {
        await prisma.loja.create({ data });
        inserted += 1;
      }
    }
    console.log(`[seed] lojas: ${inserted} inseridas, ${updated} atualizadas (total ${LOJAS_MVP.length})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
