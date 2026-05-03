import { BrandMark, BrandWordmark } from './brand';
import { SidebarNav } from './sidebar-nav';

interface Props {
  apelidoLoja: string | null;
}

export function Sidebar({ apelidoLoja }: Props) {
  return (
    <aside className="w-full lg:w-[240px] lg:shrink-0 bg-[#fafaf7] lg:border-r lg:border-strong flex flex-col px-[14px] pt-[22px] pb-4 min-h-full">
      <div className="hidden lg:flex items-center gap-[10px] px-[10px] pt-1 pb-[22px] border-b border-dashed border-strong mb-[14px]">
        <BrandMark />
        <BrandWordmark subtitle={apelidoLoja ? `RM · ${apelidoLoja}` : 'Reis Magos'} />
      </div>

      <SidebarNav />

      <div className="mt-auto pt-4 border-t border-dashed border-strong flex justify-between items-center font-sans text-[10px] tracking-[.18em] uppercase text-rm-mid">
        <span>v0.1 · 2026</span>
        <span className="w-[6px] h-[6px] rounded-full bg-rm-green" />
      </div>
    </aside>
  );
}
