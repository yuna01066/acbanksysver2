#!/usr/bin/env python3
"""Inspect CAD file metadata and local DWG/DXF conversion capabilities."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path


DWG_VERSIONS = {
    "AC1009": "AutoCAD R12",
    "AC1012": "AutoCAD R13",
    "AC1014": "AutoCAD R14",
    "AC1015": "AutoCAD 2000/2000i/2002",
    "AC1018": "AutoCAD 2004/2005/2006",
    "AC1021": "AutoCAD 2007/2008/2009",
    "AC1024": "AutoCAD 2010/2011/2012",
    "AC1027": "AutoCAD 2013/2014/2015/2016/2017",
    "AC1032": "AutoCAD 2018/2019/2020/2021/2022/2023/2024",
    "AC1036": "AutoCAD 2025/2026 or newer",
}


TOOLS = {
    "oda_file_converter": ["ODAFileConverter", "ODAFileConverter.app"],
    "libredwg_dwgread": ["dwgread"],
    "libredwg_dwg2dxf": ["dwg2dxf"],
    "autocad_console": ["accoreconsole", "accoreconsole.exe"],
    "qcad": ["qcad", "qcad.exe"],
    "librecad": ["librecad", "LibreCAD"],
}


def find_tool(candidates: list[str]) -> str | None:
    for candidate in candidates:
        found = shutil.which(candidate)
        if found:
            return found
    return None


def dwg_header(path: Path) -> tuple[str | None, str | None]:
    try:
        raw = path.read_bytes()[:32]
    except Exception:
        return None, None

    try:
        code = raw[:6].decode("ascii", errors="ignore")
    except Exception:
        code = ""

    if code.startswith("AC"):
        return code, DWG_VERSIONS.get(code, "Unknown DWG version")
    return None, None


def looks_ascii_dxf(path: Path) -> bool:
    try:
        sample = path.read_bytes()[:4096]
    except Exception:
        return False
    if b"\x00" in sample:
        return False
    text = sample.decode("utf-8", errors="ignore").upper()
    return "SECTION" in text or "HEADER" in text or "ENTITIES" in text


def inspect(path: Path) -> dict:
    suffix = path.suffix.lower()
    header_code, header_version = dwg_header(path) if suffix == ".dwg" else (None, None)
    tools = {name: find_tool(candidates) for name, candidates in TOOLS.items()}
    available = {name: value for name, value in tools.items() if value}

    return {
        "file": str(path),
        "exists": path.exists(),
        "size_bytes": path.stat().st_size if path.exists() else None,
        "extension": suffix,
        "kind": "dwg" if suffix == ".dwg" else "dxf" if suffix == ".dxf" else "unknown",
        "dwg_header": header_code,
        "dwg_version": header_version,
        "appears_ascii_dxf": looks_ascii_dxf(path) if suffix == ".dxf" else False,
        "available_tools": available,
        "missing_tools": [name for name, value in tools.items() if not value],
        "native_geometry_readable": suffix == ".dxf" and looks_ascii_dxf(path),
        "recommended_next_step": next_step(suffix, available),
    }


def next_step(suffix: str, available: dict) -> str:
    if suffix == ".dxf":
        return "Parse ASCII DXF with parse_dxf_ascii.py; if binary DXF, export ASCII DXF first."
    if suffix == ".dwg":
        if available:
            return "Convert DWG to ASCII DXF with an available converter, then parse the DXF."
        return "Install or use AutoCAD, ODA File Converter, LibreDWG, QCAD, or LibreCAD to export ASCII DXF."
    return "Provide DWG or ASCII DXF."


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cad_file", type=Path)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args(argv)

    result = inspect(args.cad_file)
    payload = json.dumps(result, ensure_ascii=False, indent=2)

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
