#!/usr/bin/env python3
"""Parse common data from ASCII DXF without external dependencies."""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path


INSUNITS = {
    0: ("unitless", None),
    1: ("in", 0.0254),
    2: ("ft", 0.3048),
    3: ("mi", 1609.344),
    4: ("mm", 0.001),
    5: ("cm", 0.01),
    6: ("m", 1.0),
    7: ("km", 1000.0),
    8: ("microin", 0.0000000254),
    9: ("mil", 0.0000254),
    10: ("yd", 0.9144),
}

FIELDS = [
    "source",
    "file",
    "layout",
    "layer",
    "entity_type",
    "category",
    "item",
    "value",
    "unit",
    "x",
    "y",
    "z",
    "width_m",
    "depth_m",
    "height_m",
    "area_sqm",
    "confidence",
    "source_note",
]


def load_pairs(path: Path) -> list[tuple[str, str]]:
    raw = path.read_bytes()
    if b"\x00" in raw[:4096]:
        raise SystemExit("This looks like binary DXF or non-text data. Export ASCII DXF first.")
    text = raw.decode("utf-8", errors="ignore")
    lines = [line.rstrip("\r\n") for line in text.splitlines()]
    pairs = []
    index = 0
    while index + 1 < len(lines):
        pairs.append((lines[index].strip(), lines[index + 1].strip()))
        index += 2
    return pairs


def sections(pairs: list[tuple[str, str]]) -> dict[str, list[tuple[str, str]]]:
    result: dict[str, list[tuple[str, str]]] = defaultdict(list)
    current = None
    index = 0
    while index < len(pairs):
        code, value = pairs[index]
        if code == "0" and value == "SECTION" and index + 1 < len(pairs):
            next_code, next_value = pairs[index + 1]
            if next_code == "2":
                current = next_value.upper()
                index += 2
                continue
        if code == "0" and value == "ENDSEC":
            current = None
            index += 1
            continue
        if current:
            result[current].append((code, value))
        index += 1
    return result


def parse_header(header_pairs: list[tuple[str, str]]) -> dict:
    header = {}
    current = None
    values = []
    for code, value in header_pairs:
        if code == "9":
            if current:
                header[current] = values[0] if len(values) == 1 else values
            current = value
            values = []
        elif current:
            values.append(value)
    if current:
        header[current] = values[0] if len(values) == 1 else values
    return header


def entities(entity_pairs: list[tuple[str, str]]) -> list[dict]:
    rows = []
    current = None
    for code, value in entity_pairs:
        if code == "0":
            if current and current["type"] not in {"ENDSEC", "EOF"}:
                rows.append(current)
            current = {"type": value, "pairs": []}
        elif current:
            current["pairs"].append((code, value))
    if current and current["type"] not in {"ENDSEC", "EOF"}:
        rows.append(current)
    return rows


def vals(entity: dict, code: str) -> list[str]:
    return [value for group_code, value in entity.get("pairs", []) if group_code == code]


def val(entity: dict, code: str, default: str = "") -> str:
    values = vals(entity, code)
    return values[0] if values else default


def as_float(value: str) -> float | None:
    try:
        return float(value)
    except Exception:
        return None


def as_int(value: str) -> int | None:
    try:
        return int(float(value))
    except Exception:
        return None


def point(entity: dict, x_code: str = "10", y_code: str = "20", z_code: str = "30") -> tuple[float | None, float | None, float | None]:
    return as_float(val(entity, x_code)), as_float(val(entity, y_code)), as_float(val(entity, z_code))


def unit_info(header: dict) -> tuple[str, float | None]:
    raw = header.get("$INSUNITS")
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    code = as_int(str(raw)) if raw is not None else None
    if code is None:
        return "drawing_units", None
    return INSUNITS.get(code, (f"insunits_{code}", None))


def convert(value: float | None, scale: float | None) -> float | None:
    if value is None or scale is None:
        return None
    return value * scale


def bbox(points: list[tuple[float, float]]) -> tuple[float | None, float | None, float | None]:
    if not points:
        return None, None, None
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), max(xs), max(ys) - min(ys)


def polygon_area(points: list[tuple[float, float]]) -> float | None:
    if len(points) < 3:
        return None
    total = 0.0
    for index, (x1, y1) in enumerate(points):
        x2, y2 = points[(index + 1) % len(points)]
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


def lwpoly_points(entity: dict) -> list[tuple[float, float]]:
    xs = [as_float(value) for value in vals(entity, "10")]
    ys = [as_float(value) for value in vals(entity, "20")]
    return [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]


def text_value(entity: dict) -> str:
    parts = vals(entity, "1") + vals(entity, "3")
    return " ".join(part for part in parts if part).strip()


def layer(entity: dict) -> str:
    return val(entity, "8", "0")


def layout(entity: dict) -> str:
    return val(entity, "410", "Model")


def categorize(entity: dict, text: str = "") -> tuple[str, str]:
    entity_type = entity["type"]
    layer_text = layer(entity).lower()
    combined = f"{layer_text} {text.lower()}"

    if entity_type in {"TEXT", "MTEXT"}:
        if any(key in combined for key in ["area", "sqm", "sq.m", "m2", "평", "면적"]):
            return "area_label", "text area annotation"
        if any(key in combined for key in ["room", "space", "실", "룸", "홀"]):
            return "room_label", "text room annotation"
        return "annotation", "text annotation"
    if entity_type == "DIMENSION":
        return "dimension", "dimension entity"
    if entity_type == "INSERT":
        if any(key in combined for key in ["door", "문", "dr"]):
            return "opening", "block/layer keyword"
        if any(key in combined for key in ["furn", "fixture", "가구", "집기"]):
            return "furniture", "block/layer keyword"
        return "block_insert", "insert entity"
    if entity_type in {"LWPOLYLINE", "POLYLINE"}:
        if any(key in combined for key in ["wall", "partition", "벽", "파티션"]):
            return "wall_boundary", "polyline layer keyword"
        if any(key in combined for key in ["area", "room", "space", "boundary", "면적", "실"]):
            return "space_boundary", "polyline layer keyword"
        return "polyline", "polyline geometry"
    if entity_type in {"LINE", "ARC", "CIRCLE"}:
        return "geometry", f"{entity_type.lower()} geometry"
    return "cad_entity", entity_type.lower()


def observation(path: Path, entity: dict, unit: str, scale: float | None) -> dict:
    entity_type = entity["type"]
    x, y, z = point(entity)
    text = text_value(entity)
    category, reason = categorize(entity, text)
    item = text or val(entity, "2") or entity_type
    value = ""
    width_m = depth_m = height_m = area_sqm = ""
    confidence = "high" if scale else "medium"

    if entity_type == "DIMENSION":
        value = text or val(entity, "42")
        if not value:
            value = ""
        confidence = "medium" if text else confidence
    elif entity_type in {"TEXT", "MTEXT"}:
        value = text
        confidence = "medium"
    elif entity_type == "INSERT":
        value = val(entity, "2")
    elif entity_type == "LINE":
        x2, y2, z2 = point(entity, "11", "21", "31")
        if None not in (x, y, x2, y2):
            length = math.hypot(x2 - x, y2 - y)
            width_m = round(convert(length, scale), 4) if scale else ""
            value = round(length, 4)
    elif entity_type == "LWPOLYLINE":
        points = lwpoly_points(entity)
        flags = as_int(val(entity, "70", "0")) or 0
        closed = bool(flags & 1)
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        if xs and ys:
            width = max(xs) - min(xs)
            depth = max(ys) - min(ys)
            width_m = round(convert(width, scale), 4) if scale else ""
            depth_m = round(convert(depth, scale), 4) if scale else ""
            if closed:
                area = polygon_area(points)
                area_sqm = round(area * scale * scale, 4) if area is not None and scale else ""
                if category == "polyline":
                    category = "space_boundary"
                    reason = "closed polyline"
                    confidence = "medium" if scale else "low"

    return {
        "source": "cad",
        "file": str(path),
        "layout": layout(entity),
        "layer": layer(entity),
        "entity_type": entity_type,
        "category": category,
        "item": item,
        "value": value,
        "unit": unit,
        "x": x if x is not None else "",
        "y": y if y is not None else "",
        "z": z if z is not None else "",
        "width_m": width_m,
        "depth_m": depth_m,
        "height_m": height_m,
        "area_sqm": area_sqm,
        "confidence": confidence,
        "source_note": reason,
    }


def summarize(ents: list[dict], header: dict, unit: str, scale: float | None) -> dict:
    counts = Counter(entity["type"] for entity in ents)
    layer_counts = Counter(layer(entity) for entity in ents)
    layouts = Counter(layout(entity) for entity in ents)
    blocks = Counter(val(entity, "2") for entity in ents if entity["type"] == "INSERT")
    return {
        "header": header,
        "unit": unit,
        "unit_scale_to_m": scale,
        "entity_counts": dict(counts),
        "layer_counts": dict(layer_counts),
        "layout_counts": dict(layouts),
        "block_insert_counts": dict(blocks),
    }


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dxf", type=Path)
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--csv-out", type=Path)
    parser.add_argument("--summary-out", type=Path)
    args = parser.parse_args(argv)

    pairs = load_pairs(args.dxf)
    sec = sections(pairs)
    header = parse_header(sec.get("HEADER", []))
    unit, scale = unit_info(header)
    ents = entities(sec.get("ENTITIES", []))
    observations = [observation(args.dxf, entity, unit, scale) for entity in ents]
    summary = summarize(ents, header, unit, scale)

    if args.csv_out:
        write_csv(args.csv_out, observations)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(observations, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.summary_out:
        args.summary_out.parent.mkdir(parents=True, exist_ok=True)
        args.summary_out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not args.csv_out and not args.json_out:
        print(json.dumps({"summary": summary, "observations": observations}, ensure_ascii=False, indent=2))

    print(f"Parsed {len(ents)} entities from {args.dxf}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
