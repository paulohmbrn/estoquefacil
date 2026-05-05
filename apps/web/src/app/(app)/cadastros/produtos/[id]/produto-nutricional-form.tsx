'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { upsertProdutoNutricional } from '@/app/_actions/produto-nutricional';
import { calcularSelosFrontais, type ValoresPor100 } from '@/lib/rotulo-anvisa';

type Categoria = 'SOLIDO' | 'LIQUIDO' | 'REFEICAO_PRONTA';
type UnidadeBase = 'g' | 'ml';

export interface ProdutoNutricionalInitial {
  unidadeBase: UnidadeBase;
  porcaoG: number | null;
  porcaoMedidaCaseira: string | null;
  porcoesEmbalagem: number | null;
  categoriaRDC429: Categoria;

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

  ingredientes: string | null;
  alergicos: string | null;
  modoPreparo: string | null;
  modoConservacao: string | null;
  conteudoLiquidoPadrao: string | null;
}

interface Props {
  produtoId: string;
  initial: ProdutoNutricionalInitial;
}

const NUMERIC_FIELDS = [
  ['valorEnergeticoKcal100', 'Valor energético (kcal)'],
  ['carboidratosG100', 'Carboidratos totais (g)'],
  ['acucaresTotaisG100', 'Açúcares totais (g)'],
  ['acucaresAdicionadosG100', 'Açúcares adicionados (g)'],
  ['proteinasG100', 'Proteínas (g)'],
  ['gordurasTotaisG100', 'Gorduras totais (g)'],
  ['gordurasSaturadasG100', 'Gorduras saturadas (g)'],
  ['gordurasTransG100', 'Gorduras trans (g)'],
  ['fibrasG100', 'Fibra alimentar (g)'],
  ['sodioMg100', 'Sódio (mg)'],
] as const;

export function ProdutoNutricionalForm({ produtoId, initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<Categoria>(initial.categoriaRDC429);
  const [unidadeBase, setUnidadeBase] = useState<UnidadeBase>(initial.unidadeBase);
  const [valores, setValores] = useState(() => ({
    valorEnergeticoKcal100: initial.valorEnergeticoKcal100 ?? null,
    carboidratosG100: initial.carboidratosG100 ?? null,
    acucaresTotaisG100: initial.acucaresTotaisG100 ?? null,
    acucaresAdicionadosG100: initial.acucaresAdicionadosG100 ?? null,
    proteinasG100: initial.proteinasG100 ?? null,
    gordurasTotaisG100: initial.gordurasTotaisG100 ?? null,
    gordurasSaturadasG100: initial.gordurasSaturadasG100 ?? null,
    gordurasTransG100: initial.gordurasTransG100 ?? null,
    fibrasG100: initial.fibrasG100 ?? null,
    sodioMg100: initial.sodioMg100 ?? null,
  }));
  const router = useRouter();

  const selosPreview = useMemo(() => {
    const v: ValoresPor100 = {
      unidadeBase,
      porcaoG: initial.porcaoG,
      porcoesEmbalagem: initial.porcoesEmbalagem,
      porcaoMedidaCaseira: initial.porcaoMedidaCaseira,
      categoriaRDC429: categoria,
      ...valores,
    };
    return calcularSelosFrontais(v);
  }, [unidadeBase, categoria, valores, initial]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setOkMsg(null);
        setErro(null);
        const fd = new FormData(e.currentTarget);
        const payload = {
          produtoId,
          unidadeBase,
          categoriaRDC429: categoria,
          porcaoG: parseNum(fd.get('porcaoG')),
          porcaoMedidaCaseira: (fd.get('porcaoMedidaCaseira') as string) || null,
          porcoesEmbalagem: parseNum(fd.get('porcoesEmbalagem')),

          valorEnergeticoKcal100: parseNum(fd.get('valorEnergeticoKcal100')),
          carboidratosG100: parseNum(fd.get('carboidratosG100')),
          acucaresTotaisG100: parseNum(fd.get('acucaresTotaisG100')),
          acucaresAdicionadosG100: parseNum(fd.get('acucaresAdicionadosG100')),
          proteinasG100: parseNum(fd.get('proteinasG100')),
          gordurasTotaisG100: parseNum(fd.get('gordurasTotaisG100')),
          gordurasSaturadasG100: parseNum(fd.get('gordurasSaturadasG100')),
          gordurasTransG100: parseNum(fd.get('gordurasTransG100')),
          fibrasG100: parseNum(fd.get('fibrasG100')),
          sodioMg100: parseNum(fd.get('sodioMg100')),

          ingredientes: (fd.get('ingredientes') as string) || null,
          alergicos: (fd.get('alergicos') as string) || null,
          modoPreparo: (fd.get('modoPreparo') as string) || null,
          modoConservacao: (fd.get('modoConservacao') as string) || null,
          conteudoLiquidoPadrao: (fd.get('conteudoLiquidoPadrao') as string) || null,
        };
        startTransition(async () => {
          const r = await upsertProdutoNutricional(payload);
          if (r.ok) {
            setOkMsg('Salvo.');
            router.refresh();
          } else {
            setErro(r.error);
          }
        });
      }}
      className="space-y-5"
    >
      {/* Categoria + unidade base */}
      <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Categoria do produto (RDC 429)">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria)}
            className="w-full bg-white border border-hairline px-3 py-2 rounded-xs text-[13px]"
          >
            <option value="SOLIDO">Sólido</option>
            <option value="LIQUIDO">Líquido</option>
            <option value="REFEICAO_PRONTA">Refeição pronta</option>
          </select>
        </Field>
        <Field label="Base de referência da tabela">
          <select
            value={unidadeBase}
            onChange={(e) => setUnidadeBase(e.target.value as UnidadeBase)}
            className="w-full bg-white border border-hairline px-3 py-2 rounded-xs text-[13px]"
          >
            <option value="g">por 100 g (sólido)</option>
            <option value="ml">por 100 ml (líquido)</option>
          </select>
        </Field>
      </fieldset>

      {/* Porção */}
      <fieldset className="bg-[#fafaf7] border border-hairline rounded-xs p-3 space-y-3">
        <legend className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid px-1">
          Porção
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={`Tamanho da porção (${unidadeBase})`}>
            <Input name="porcaoG" type="number" min={0} step="0.1" defaultValue={initial.porcaoG ?? ''} placeholder="ex: 40" />
          </Field>
          <Field label="Medida caseira">
            <Input name="porcaoMedidaCaseira" defaultValue={initial.porcaoMedidaCaseira ?? ''} placeholder="2 fatias" />
          </Field>
          <Field label="Porções por embalagem">
            <Input name="porcoesEmbalagem" type="number" min={0} step="0.5" defaultValue={initial.porcoesEmbalagem ?? ''} placeholder="ex: 5" />
          </Field>
        </div>
      </fieldset>

      {/* Valores nutricionais */}
      <fieldset className="space-y-2">
        <legend className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-2">
          Valores nutricionais por 100 {unidadeBase}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NUMERIC_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                name={key}
                type="number"
                min={0}
                step="0.1"
                defaultValue={valores[key] ?? ''}
                onChange={(e) =>
                  setValores((v) => ({ ...v, [key]: e.target.value === '' ? null : Number(e.target.value) }))
                }
              />
            </Field>
          ))}
        </div>
      </fieldset>

      {/* Selos frontais — preview */}
      <div className="bg-[#fafaf7] border border-hairline rounded-xs p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-2">
          Selos frontais que serão impressos (RDC 429)
        </p>
        <div className="flex flex-wrap gap-2">
          <Selo on={selosPreview.acucarAdicionado}>Açúcar adicionado</Selo>
          <Selo on={selosPreview.gorduraSaturada}>Gordura saturada</Selo>
          <Selo on={selosPreview.sodio}>Sódio</Selo>
          {!selosPreview.acucarAdicionado && !selosPreview.gorduraSaturada && !selosPreview.sodio && (
            <span className="text-[12px] text-rm-mid italic">Nenhum selo necessário com os valores atuais.</span>
          )}
        </div>
      </div>

      {/* Texto livre */}
      <fieldset className="space-y-3">
        <Field label="Ingredientes">
          <textarea
            name="ingredientes"
            defaultValue={initial.ingredientes ?? ''}
            rows={3}
            className="w-full px-3 py-2 text-[13px] font-sans bg-white border border-hairline rounded-xs text-rm-ink placeholder:text-rm-mid focus:outline-none focus:border-rm-green focus:shadow-focus"
            placeholder="Farinha de trigo italiana, manteiga sem sal, leite integral, ovos, açúcar, sal, cacau em pó, fermento biológico e água."
          />
        </Field>
        <Field label="Alergênicos (frase em destaque)">
          <textarea
            name="alergicos"
            defaultValue={initial.alergicos ?? ''}
            rows={2}
            className="w-full px-3 py-2 text-[13px] font-sans bg-white border border-hairline rounded-xs text-rm-ink placeholder:text-rm-mid focus:outline-none focus:border-rm-green focus:shadow-focus"
            placeholder="ALÉRGICOS: CONTÉM TRIGO, OVOS E LEITE · CONTÉM GLÚTEN"
          />
        </Field>
        <Field label="Modo de preparo">
          <textarea
            name="modoPreparo"
            defaultValue={initial.modoPreparo ?? ''}
            rows={2}
            className="w-full px-3 py-2 text-[13px] font-sans bg-white border border-hairline rounded-xs text-rm-ink placeholder:text-rm-mid focus:outline-none focus:border-rm-green focus:shadow-focus"
            placeholder="Air Fryer: aqueça o produto por 7 minutos a 160°C. / Forno convencional: 10 minutos a 180°C."
          />
        </Field>
        <Field label="Modo de conservação">
          <textarea
            name="modoConservacao"
            defaultValue={initial.modoConservacao ?? ''}
            rows={2}
            className="w-full px-3 py-2 text-[13px] font-sans bg-white border border-hairline rounded-xs text-rm-ink placeholder:text-rm-mid focus:outline-none focus:border-rm-green focus:shadow-focus"
            placeholder="Congelado -18°C: 40 dias. Refrigerado +4°C: 5 dias."
          />
        </Field>
        <Field label="Conteúdo líquido padrão (sugestão na hora de imprimir)">
          <Input
            name="conteudoLiquidoPadrao"
            defaultValue={initial.conteudoLiquidoPadrao ?? ''}
            placeholder="6 UNI"
          />
        </Field>
      </fieldset>

      {okMsg && <p className="text-rm-green text-[12px]">{okMsg}</p>}
      {erro && <p className="text-rm-red text-[12px]">{erro}</p>}

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar informação nutricional'}
        </Button>
      </div>
    </form>
  );
}

function Selo({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        on
          ? 'inline-flex items-center px-3 py-1.5 rounded-full bg-rm-ink text-rm-cream text-[11px] font-semibold uppercase tracking-[.14em]'
          : 'inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-hairline text-rm-mid text-[11px] font-semibold uppercase tracking-[.14em] line-through'
      }
    >
      Alto em {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function parseNum(v: FormDataEntryValue | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
