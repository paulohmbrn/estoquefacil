#!/usr/bin/env python3
"""Converte as logomarcas (docs/logos/*.png) pra ZPL ^GFA e gera
apps/web/src/lib/etiqueta-logos.ts.

Rodar: python3 scripts/gen-etiqueta-logos.py
Requer: Pillow (pip install Pillow)

As impressoras térmicas só imprimem 1-bit (preto/branco), então:
  - achata transparência sobre branco
  - converte pra luminância
  - redimensiona com LANCZOS
  - aplica threshold (qualquer pixel < THRESHOLD vira tinta)
"""
from PIL import Image
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THRESHOLD = 200  # pixels mais escuros que isso viram preto

# (chave no TS, caminho do PNG, largura alvo em dots @203dpi)
LOGOS = [
    ("madrePane", os.path.join(ROOT, "docs/logos/Logo Madre Pane.png"), 286),
    ("ffb",       os.path.join(ROOT, "docs/logos/Logo FFB.png"),        290),
]
NAME_MAP = {"madrePane": "LOGO_MADRE_PANE", "ffb": "LOGO_FFB"}


def png_to_gfa(path: str, target_w: int):
    img = Image.open(path)
    if img.mode == "P":
        img = img.convert("RGBA")
    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        rgba = img.convert("RGBA")
        bg.paste(rgba, mask=rgba.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")
    img = img.convert("L")
    w0, h0 = img.size
    target_h = max(1, round(h0 * target_w / w0))
    img = img.resize((target_w, target_h), Image.LANCZOS)
    img = img.point(lambda p: 0 if p < THRESHOLD else 255, mode="L").convert("1")
    w, h = img.size
    bpr = (w + 7) // 8
    total = bpr * h
    px = img.load()
    raw = bytearray()
    for y in range(h):
        bb = 0
        nb = 0
        row = bytearray()
        for x in range(w):
            ink = 1 if px[x, y] == 0 else 0
            bb = (bb << 1) | ink
            nb += 1
            if nb == 8:
                row.append(bb)
                bb = 0
                nb = 0
        if nb:
            row.append(bb << (8 - nb))
        raw.extend(row)
    return {"w": w, "h": h, "bpr": bpr, "total": total, "hex": raw.hex().upper()}


def main():
    out = {}
    for key, path, tw in LOGOS:
        out[key] = png_to_gfa(path, tw)
        print(f"{key}: {out[key]['w']}x{out[key]['h']} bpr={out[key]['bpr']} total={out[key]['total']}")

    lines = []
    A = lines.append
    A("// AUTO-GERADO por scripts/gen-etiqueta-logos.py — NÃO editar à mão.")
    A("// Logomarcas convertidas pra ZPL ^GFA (bitmap 1-bit). Fonte: docs/logos/*.png")
    A("//")
    A("// Pra regenerar (logo novo, tamanho diferente): python3 scripts/gen-etiqueta-logos.py")
    A("")
    A("export interface LogoZpl {")
    A("  /** largura em dots (1 dot = 1 px @ 203dpi). */")
    A("  width: number;")
    A("  /** altura em dots. */")
    A("  height: number;")
    A("  /** bytes por linha (ceil(width/8)). */")
    A("  bytesPerRow: number;")
    A("  /** total de bytes do bitmap (bytesPerRow * height). */")
    A("  totalBytes: number;")
    A("  /** dados hex (ASCII, uppercase) — vai direto no ^GFA. */")
    A("  hex: string;")
    A("}")
    A("")
    A("/** Monta o comando ^GFA completo a partir de um LogoZpl. */")
    A("export function logoGfa(logo: LogoZpl): string {")
    A("  return `^GFA,${logo.totalBytes},${logo.totalBytes},${logo.bytesPerRow},${logo.hex}`;")
    A("}")
    A("")
    for key, v in out.items():
        nm = NAME_MAP[key]
        A(f"export const {nm}: LogoZpl = {{")
        A(f"  width: {v['w']},")
        A(f"  height: {v['h']},")
        A(f"  bytesPerRow: {v['bpr']},")
        A(f"  totalBytes: {v['total']},")
        A(f"  hex: '{v['hex']}',")
        A("};")
        A("")
    A("/** Resolve o logo pela filial (zmartbiId). null = sem logo. */")
    A("export function logoPorFilial(zmartbiId: string | null | undefined): LogoZpl | null {")
    A("  switch (zmartbiId) {")
    A("    case '0023':")
    A("      return LOGO_MADRE_PANE;")
    A("    case '0013':")
    A("      return LOGO_FFB;")
    A("    default:")
    A("      return null;")
    A("  }")
    A("}")
    A("")
    dest = os.path.join(ROOT, "apps/web/src/lib/etiqueta-logos.ts")
    open(dest, "w").write("\n".join(lines))
    print("escrito", dest)
    # debug json opcional
    open(os.path.join(ROOT, "scripts/.logos-gfa.json"), "w").write(json.dumps(out))


if __name__ == "__main__":
    main()
