"""Gera shared/legalTexts.ts a partir de docs/juridico/*.md (fonte única dos textos do app)."""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
def parse(name):
    text = (root / "docs/juridico" / name).read_text(encoding="utf-8")
    text = re.sub(r"^---.*?---\s*", "", text, flags=re.S)
    sections, cur = [], None
    for line in text.splitlines():
        if line.startswith("## "):
            cur = {"h": line[3:].strip(), "p": []}; sections.append(cur); continue
        if cur is None or not line.strip() or re.match(r"^\|[-| ]+\|$", line.strip()): continue
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            line = " — ".join(cells)
        line = re.sub(r"\*\*(.+?)\*\*", r"\1", line).strip()
        cur["p"].append(line)
    return [{"h": s["h"], "p": s["p"]} for s in sections]
out = "// GERADO por scripts/gen-legal-texts.py a partir de docs/juridico. Não edite à mão.\n"
out += "export const LEGAL_TEXT_VERSION = \"2026-11-05 (versão preliminar)\";\n"
out += "export const LEGAL_TEXTS: Record<\"termos\" | \"privacidade\", Array<{ h: string; p: string[] }>> = " + json.dumps({"termos": parse("termos-de-uso.md"), "privacidade": parse("politica-de-privacidade.md")}, ensure_ascii=False, indent=1) + ";\n"
(root / "shared/legalTexts.ts").write_text(out, encoding="utf-8")
