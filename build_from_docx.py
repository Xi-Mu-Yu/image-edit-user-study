# -*- coding: utf-8 -*-
"""Export 图像效果.docx into a static GitHub Pages user-study site."""
from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path

from lxml import etree

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
DOCX = PROJECT / "图像效果.docx"
BILINGUAL = PROJECT / "每行编辑指令_中英双语文案.json"
OUT_IMAGES = ROOT / "images"
OUT_DATA = ROOT / "data" / "cases.json"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
R_EMBED = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"

LABELS = ["real", "A", "B", "C", "D", "E"]


def parse_instruction_block(text: str) -> dict:
    """Parse bilingual instruction cell text into fields."""
    lines = [ln.strip() for ln in text.replace("\r", "").split("\n") if ln.strip()]
    joined = "\n".join(lines)

    def grab(en_key: str, zh_key: str | None = None) -> tuple[str, str]:
        en, zh = "", ""
        # EN: ... then optional 中文:
        m = re.search(
            rf"{re.escape(en_key)}\s*[:：]\s*(.+?)(?:\n|$)",
            joined,
            flags=re.IGNORECASE,
        )
        if m:
            en = m.group(1).strip()
        if zh_key:
            m2 = re.search(rf"{re.escape(zh_key)}\s*[:：]\s*(.+?)(?:\n|$)", joined)
            if m2:
                zh = m2.group(1).strip()
        return en, zh

    instr_en, instr_zh = grab("EN", "中文")
    # Prefer structured bilingual file later; this is fallback from cell.
    # Try more robust section parsing.
    sections = {
        "instruction_en": "",
        "instruction_zh": "",
        "original_en": "",
        "original_zh": "",
        "editing_en": "",
        "editing_zh": "",
    }

    # Split by known headers
    parts = re.split(
        r"(【编辑指令\s*/\s*Editing Instruction】|【原始提示\s*/\s*Original Prompt】|【编辑提示\s*/\s*Editing Prompt】)",
        joined,
    )
    bucket = None
    for part in parts:
        if "Editing Instruction" in part:
            bucket = "instruction"
            continue
        if "Original Prompt" in part:
            bucket = "original"
            continue
        if "Editing Prompt" in part:
            bucket = "editing"
            continue
        if bucket is None:
            continue
        en_m = re.search(r"EN\s*[:：]\s*(.+)", part)
        zh_m = re.search(r"中文\s*[:：]\s*(.+)", part)
        if en_m:
            sections[f"{bucket}_en"] = en_m.group(1).strip()
        if zh_m:
            sections[f"{bucket}_zh"] = zh_m.group(1).strip()

    if not sections["instruction_en"] and instr_en:
        sections["instruction_en"] = instr_en
        sections["instruction_zh"] = instr_zh
    return sections


def load_rid_map(zf: zipfile.ZipFile) -> dict[str, str]:
    rels = etree.fromstring(zf.read("word/_rels/document.xml.rels"))
    rid_map: dict[str, str] = {}
    for rel in rels:
        rid = rel.get("Id")
        tgt = rel.get("Target") or ""
        if rid and "media/" in tgt.replace("\\", "/"):
            rid_map[rid] = tgt.replace("\\", "/").split("/")[-1]
    return rid_map


def row_text(tr) -> str:
    texts = []
    for node in tr.xpath(".//w:t", namespaces=NS):
        if node.text:
            texts.append(node.text)
    return "\n".join(texts)


def main() -> None:
    if not DOCX.exists():
        raise SystemExit(f"Missing docx: {DOCX}")

    bilingual = []
    if BILINGUAL.exists():
        bilingual = json.loads(BILINGUAL.read_text(encoding="utf-8"))

    if OUT_IMAGES.exists():
        shutil.rmtree(OUT_IMAGES)
    OUT_IMAGES.mkdir(parents=True)
    OUT_DATA.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(DOCX) as zf:
        rid_map = load_rid_map(zf)
        doc = etree.fromstring(zf.read("word/document.xml"))
        rows = doc.xpath("//w:tbl/w:tr", namespaces=NS)

        cases = []
        case_idx = 0
        i = 0
        while i < len(rows):
            tr = rows[i]
            blips = tr.xpath(".//a:blip", namespaces=NS)
            if not blips:
                i += 1
                continue

            rids = [b.get(R_EMBED) for b in blips]
            files = [rid_map.get(r) for r in rids]
            if len(files) < 6 or any(f is None for f in files[:6]):
                i += 1
                continue

            # Next non-empty text row should be instruction
            instr = {
                "instruction_en": "",
                "instruction_zh": "",
                "original_en": "",
                "original_zh": "",
                "editing_en": "",
                "editing_zh": "",
            }
            j = i + 1
            while j < len(rows):
                txt = row_text(rows[j]).strip()
                if not txt:
                    j += 1
                    continue
                if "Editing Instruction" in txt or "编辑指令" in txt:
                    instr = parse_instruction_block(txt)
                    break
                if rows[j].xpath(".//a:blip", namespaces=NS):
                    break
                j += 1

            case_idx += 1
            bi = bilingual[case_idx - 1] if case_idx - 1 < len(bilingual) else {}
            image_id = bi.get("image_id") or f"{case_idx:012d}"

            saved = {}
            for label, fname in zip(LABELS, files[:6]):
                src_name = fname
                ext = Path(src_name).suffix.lower() or ".jpeg"
                out_name = f"case_{case_idx:03d}_{label}{ext}"
                raw = zf.read(f"word/media/{src_name}")
                (OUT_IMAGES / out_name).write_bytes(raw)
                saved[label] = f"images/{out_name}"

            case = {
                "id": case_idx,
                "image_id": image_id,
                "instruction_en": bi.get("editing_instruction_en")
                or instr["instruction_en"],
                "instruction_zh": bi.get("editing_instruction_zh")
                or instr["instruction_zh"],
                "original_prompt_en": bi.get("original_prompt_en") or instr["original_en"],
                "original_prompt_zh": bi.get("original_prompt_zh") or instr["original_zh"],
                "editing_prompt_en": bi.get("editing_prompt_en") or instr["editing_en"],
                "editing_prompt_zh": bi.get("editing_prompt_zh") or instr["editing_zh"],
                "images": saved,
            }
            cases.append(case)
            i = j + 1 if j > i else i + 1

        payload = {
            "title": "User Study Evaluation Form / 用户研究评测问卷",
            "criteria": [
                {
                    "key": "semantics",
                    "en": "Target Semantics Alignment",
                    "zh": "目标语义对齐",
                },
                {
                    "key": "background",
                    "en": "Background Preservation",
                    "zh": "背景保持",
                },
            ],
            "methods": ["A", "B", "C", "D", "E"],
            "scale": {"min": 1, "max": 5},
            "cases": cases,
        }
        OUT_DATA.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Exported {len(cases)} cases -> {OUT_DATA}")
        print(f"Images -> {OUT_IMAGES} ({len(list(OUT_IMAGES.glob('*')))} files)")


if __name__ == "__main__":
    main()
