#!/usr/bin/env python3
"""ACBANK acrylic yield calculator.

This helper mirrors the internal browser-side heuristic described in
yield-calculation-logic.md:

- thickness-based spacing: under 10T = 6mm, 10T and above = 8mm
- four sort strategies: area, long-edge, wide-first, tall-first
- candidate-coordinate placement using right/down points
- rotation trial with a small penalty when allowed
- offcut analysis with a 300x300mm reusable minimum
- score-based recommendation ranking
- --logic-candidates evaluates the current fallback auto recommendation set only

It is not a global nesting optimizer and does not replace production CAM review.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass
from functools import cmp_to_key
from typing import Iterable


MAX_PANELS = 50
REUSABLE_MIN_WIDTH = 300.0
REUSABLE_MIN_HEIGHT = 300.0
INVALID_SCORE = 1_000_000_000_000_000.0
STRATEGIES = ("area", "long-edge", "wide-first", "tall-first")

BASE_SIZE_MAPPING = {
    "3*6": (860.0, 1750.0),
    "대3*6": (900.0, 1800.0),
    "4*5": (1120.0, 1425.0),
    "대4*5": (1200.0, 1500.0),
    "1*2": (1000.0, 2000.0),
    "4*6": (1200.0, 1800.0),
    "4*8": (1200.0, 2400.0),
    "4*10": (1200.0, 3000.0),
    "5*6": (1500.0, 1800.0),
    "5*8": (1500.0, 2400.0),
}


@dataclass(frozen=True)
class Part:
    name: str
    width: float
    height: float
    quantity: int
    shape: str = "rect"
    area_mm2: float | None = None
    source_spec: str | None = None

    @property
    def unit_area_mm2(self) -> float:
        if self.area_mm2 is not None:
            return self.area_mm2
        return self.width * self.height


@dataclass(frozen=True)
class Piece:
    id: str
    part_name: str
    width: float
    height: float
    area_mm2: float
    shape: str


@dataclass(frozen=True)
class PanelCandidate:
    name: str
    width: float
    height: float
    basis: str

    @property
    def area_mm2(self) -> float:
        return self.width * self.height


@dataclass(frozen=True)
class Placement:
    piece_id: str
    part_name: str
    x: float
    y: float
    width: float
    height: float
    area_mm2: float
    rotated: bool


def parse_size(value: str) -> tuple[float, float]:
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*", value)
    if not match:
        raise argparse.ArgumentTypeError("size must be WIDTHxHEIGHT, for example 1220x2440")
    width, height = float(match.group(1)), float(match.group(2))
    validate_positive(width, height)
    return width, height


def split_named_spec(value: str) -> tuple[str, str]:
    if ":" not in value:
        return "part", value
    name, spec = value.split(":", 1)
    return name.strip() or "part", spec


def parse_part(value: str) -> Part:
    name, spec = split_named_spec(value)
    match = re.fullmatch(
        r"\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+)\s*",
        spec,
    )
    if not match:
        raise argparse.ArgumentTypeError(
            "part must be NAME:WIDTHxHEIGHTxQTY or WIDTHxHEIGHTxQTY"
        )
    width = float(match.group(1))
    height = float(match.group(2))
    quantity = int(match.group(3))
    validate_positive(width, height, quantity)
    return Part(name=name, width=width, height=height, quantity=quantity, source_spec=spec)


def parse_trapezoid(value: str) -> Part:
    name, spec = split_named_spec(value)
    match = re.fullmatch(
        r"\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+)\s*",
        spec,
    )
    if not match:
        raise argparse.ArgumentTypeError(
            "trapezoid must be NAME:TOPxBOTTOMxHEIGHTxQTY or TOPxBOTTOMxHEIGHTxQTY"
        )
    top = float(match.group(1))
    bottom = float(match.group(2))
    height = float(match.group(3))
    quantity = int(match.group(4))
    validate_positive(top, bottom, height, quantity)
    width = max(top, bottom)
    area = ((top + bottom) * height) / 2
    return Part(
        name=name,
        width=width,
        height=height,
        quantity=quantity,
        shape="trapezoid",
        area_mm2=area,
        source_spec=f"top={top}, bottom={bottom}, height={height}",
    )


def parse_panel(value: str) -> PanelCandidate:
    name, spec = split_named_spec(value)
    width, height = parse_size(spec)
    if name == "part":
        name = f"{int(width) if width.is_integer() else width}x{int(height) if height.is_integer() else height}"
    return PanelCandidate(name=name, width=width, height=height, basis="manual")


def validate_positive(*values: float | int) -> None:
    if any(value <= 0 for value in values):
        raise argparse.ArgumentTypeError("all dimensions and quantities must be positive")


def parse_thickness(value: str | None) -> float | None:
    if not value:
        return None
    match = re.search(r"\d+(?:\.\d+)?", value)
    if not match:
        raise argparse.ArgumentTypeError("thickness must contain a number, for example 5T")
    thickness = float(match.group(0))
    if thickness <= 0:
        raise argparse.ArgumentTypeError("thickness must be positive")
    return thickness


def spacing_from_inputs(
    *,
    thickness: float | None,
    spacing: float | None,
    kerf: float | None,
) -> tuple[float, str]:
    if spacing is not None:
        return spacing, "explicit_spacing"
    if kerf is not None:
        return kerf, "explicit_kerf"
    if thickness is None:
        return 0.0, "not_provided"
    return (6.0, "thickness_under_10T") if thickness < 10 else (8.0, "thickness_10T_or_above")


def adjusted_preset_size(name: str, thickness: float | None) -> tuple[float, float]:
    if name not in BASE_SIZE_MAPPING:
        known = ", ".join(BASE_SIZE_MAPPING)
        raise argparse.ArgumentTypeError(f"unknown preset {name!r}; known presets: {known}")
    width, height = BASE_SIZE_MAPPING[name]
    if thickness is None:
        return width, height
    if 1.3 <= thickness < 10:
        return width + 20, height + 20
    if 20 < thickness <= 30:
        return width - 50, height - 50
    return width, height


def part_to_json(part: Part) -> dict:
    return {
        "name": part.name,
        "shape": part.shape,
        "width_mm": part.width,
        "height_mm": part.height,
        "quantity": part.quantity,
        "unit_area_mm2": round(part.unit_area_mm2, 3),
        "total_area_mm2": round(part.unit_area_mm2 * part.quantity, 3),
        "source_spec": part.source_spec,
    }


def expand_pieces(parts: Iterable[Part]) -> list[Piece]:
    pieces: list[Piece] = []
    for part in parts:
        for index in range(part.quantity):
            pieces.append(
                Piece(
                    id=f"{part.name}#{index + 1}",
                    part_name=part.name,
                    width=part.width,
                    height=part.height,
                    area_mm2=part.unit_area_mm2,
                    shape=part.shape,
                )
            )
    return pieces


def parts_from_pieces(pieces: list[Piece], part_lookup: dict[str, Part]) -> list[Part]:
    grouped: dict[str, int] = {}
    for piece in pieces:
        grouped[piece.part_name] = grouped.get(piece.part_name, 0) + 1
    return [
        Part(
            name=name,
            width=part_lookup[name].width,
            height=part_lookup[name].height,
            quantity=quantity,
            shape=part_lookup[name].shape,
            area_mm2=part_lookup[name].area_mm2,
            source_spec=part_lookup[name].source_spec,
        )
        for name, quantity in grouped.items()
    ]


def area_totals(parts: Iterable[Part]) -> tuple[int, float]:
    part_list = list(parts)
    return (
        sum(part.quantity for part in part_list),
        sum(part.unit_area_mm2 * part.quantity for part in part_list),
    )


def area_only_result(parts: list[Part]) -> dict:
    total_quantity, total_part_area = area_totals(parts)
    return {
        "mode": "area_only",
        "parts": [part_to_json(part) for part in parts],
        "total_quantity": total_quantity,
        "total_part_area_mm2": round(total_part_area, 3),
        "total_part_area_m2": round(total_part_area / 1_000_000, 6),
        "yield_status": "insufficient_data",
        "missing_fields": ["stock_sheet"],
        "warnings": [
            "Stock sheet size was not provided, so sheet count and yield percent were not calculated.",
        ],
    }


def sorted_pieces(pieces: list[Piece], strategy: str) -> list[Piece]:
    if strategy == "area":
        key = lambda piece: (piece.area_mm2, max(piece.width, piece.height), piece.width)
    elif strategy == "long-edge":
        key = lambda piece: (max(piece.width, piece.height), piece.area_mm2, piece.width)
    elif strategy == "wide-first":
        key = lambda piece: (piece.width, piece.area_mm2, max(piece.width, piece.height))
    elif strategy == "tall-first":
        key = lambda piece: (piece.height, piece.area_mm2, max(piece.width, piece.height))
    else:
        raise ValueError(f"unknown strategy {strategy}")
    return sorted(pieces, key=key, reverse=True)


def piece_orientations(piece: Piece, allow_rotate: bool) -> list[tuple[float, float, bool]]:
    orientations = [(piece.width, piece.height, False)]
    if allow_rotate and piece.width != piece.height:
        orientations.append((piece.height, piece.width, True))
    return orientations


def can_piece_fit(piece: Piece, panel: PanelCandidate, allow_rotate: bool) -> bool:
    return any(
        width <= panel.width and height <= panel.height
        for width, height, _ in piece_orientations(piece, allow_rotate)
    )


def collides(
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    placements: list[Placement],
    spacing: float,
) -> bool:
    for placed in placements:
        separated = (
            x >= placed.x + placed.width + spacing
            or x + width + spacing <= placed.x
            or y >= placed.y + placed.height + spacing
            or y + height + spacing <= placed.y
        )
        if not separated:
            return True
    return False


def score_candidate(
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    rotated: bool,
    placements: list[Placement],
    panel: PanelCandidate,
) -> float:
    used_right = max([placement.x + placement.width for placement in placements] + [x + width])
    used_bottom = max([placement.y + placement.height for placement in placements] + [y + height])
    bounding_area = used_right * used_bottom
    largest_offcut = max(
        0.0,
        (panel.width - used_right) * panel.height,
        used_right * (panel.height - used_bottom),
        (panel.width - used_right) * (panel.height - used_bottom),
    )
    score = (
        bounding_area * 0.001
        + y * 10
        + x
        + abs((panel.width - used_right) - (panel.height - used_bottom)) * 0.02
        - largest_offcut * 0.0004
    )
    if rotated:
        score += 2
    return score


def dedupe_candidates(candidates: Iterable[tuple[float, float]], panel: PanelCandidate) -> list[tuple[float, float]]:
    seen: set[tuple[float, float]] = set()
    result: list[tuple[float, float]] = []
    for x, y in candidates:
        if x > panel.width or y > panel.height:
            continue
        key = (round(x, 4), round(y, 4))
        if key not in seen:
            seen.add(key)
            result.append((x, y))
    result.sort(key=lambda point: (point[1], point[0]))
    return result


def pack_single_panel(
    pieces: list[Piece],
    panel: PanelCandidate,
    *,
    spacing: float,
    allow_rotate: bool,
) -> tuple[list[Placement], set[str]]:
    candidates: list[tuple[float, float]] = [(0.0, 0.0)]
    placements: list[Placement] = []
    placed_ids: set[str] = set()

    for piece in pieces:
        best: tuple[float, Placement] | None = None
        for x, y in candidates:
            for width, height, rotated in piece_orientations(piece, allow_rotate):
                if x + width > panel.width or y + height > panel.height:
                    continue
                if collides(x=x, y=y, width=width, height=height, placements=placements, spacing=spacing):
                    continue
                placement = Placement(
                    piece_id=piece.id,
                    part_name=piece.part_name,
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    area_mm2=piece.area_mm2,
                    rotated=rotated,
                )
                score = score_candidate(
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    rotated=rotated,
                    placements=placements,
                    panel=panel,
                )
                if best is None or score < best[0]:
                    best = (score, placement)

        if best is None:
            continue

        placement = best[1]
        placements.append(placement)
        placed_ids.add(piece.id)
        candidates.extend(
            [
                (placement.x + placement.width + spacing, placement.y),
                (placement.x, placement.y + placement.height + spacing),
            ]
        )
        candidates = dedupe_candidates(candidates, panel)

    return placements, placed_ids


def rect_json(width: float, height: float) -> dict:
    return {
        "width_mm": round(width, 3),
        "height_mm": round(height, 3),
        "area_mm2": round(max(0.0, width) * max(0.0, height), 3),
    }


def panel_to_json(panel: PanelCandidate) -> dict:
    return {
        "name": panel.name,
        "width_mm": panel.width,
        "height_mm": panel.height,
        "area_mm2": round(panel.area_mm2, 3),
        "basis": panel.basis,
    }


def candidate_basis(args: argparse.Namespace) -> dict:
    modes: list[str] = []
    if args.stock:
        modes.append("manual_stock")
    if args.panel:
        modes.append("provided_panel_candidates")
    if args.preset:
        modes.append("logic_named_presets")
    if args.all_presets:
        modes.append("logic_auto_candidates")

    if not modes:
        mode = "none"
    elif len(modes) == 1:
        mode = modes[0]
    else:
        mode = "mixed"

    return {
        "mode": mode,
        "components": modes,
        "logic_source": "yield-calculation-logic.md fallback panel candidates",
        "notes": [
            "DB panel_sizes are not queried by this standalone script; pass DB-active sizes with --panel.",
            "Use --logic-candidates for the current fallback auto recommendation candidates only.",
        ],
    }


def analyze_offcuts(placements: list[Placement], panel: PanelCandidate) -> dict:
    panel_area = panel.area_mm2
    placed_area = sum(placement.area_mm2 for placement in placements)
    waste_area = max(0.0, panel_area - placed_area)
    if not placements:
        largest = {"width_mm": 0.0, "height_mm": 0.0, "area_mm2": 0.0}
        return {
            "used_right_mm": 0.0,
            "used_bottom_mm": 0.0,
            "waste_area_mm2": round(waste_area, 3),
            "scrap_area_mm2": round(waste_area, 3),
            "fragmentation_penalty": round(waste_area * 1.5, 3),
            "largest_reusable_rect": largest,
            "reusable_candidates": [],
        }

    used_right = max(placement.x + placement.width for placement in placements)
    used_bottom = max(placement.y + placement.height for placement in placements)
    candidates = [
        rect_json(panel.width - used_right, panel.height),
        rect_json(used_right, panel.height - used_bottom),
        rect_json(panel.width - used_right, panel.height - used_bottom),
    ]
    reusable = [
        rect
        for rect in candidates
        if rect["width_mm"] >= REUSABLE_MIN_WIDTH and rect["height_mm"] >= REUSABLE_MIN_HEIGHT
    ]
    largest = max(reusable, key=lambda rect: rect["area_mm2"], default={"width_mm": 0.0, "height_mm": 0.0, "area_mm2": 0.0})
    reusable_area = largest["area_mm2"]
    scrap_area = max(0.0, waste_area - reusable_area)
    fragmentation_penalty = scrap_area + max(0.0, waste_area - reusable_area) * 0.5
    return {
        "used_right_mm": round(used_right, 3),
        "used_bottom_mm": round(used_bottom, 3),
        "waste_area_mm2": round(waste_area, 3),
        "scrap_area_mm2": round(scrap_area, 3),
        "fragmentation_penalty": round(fragmentation_penalty, 3),
        "largest_reusable_rect": largest,
        "reusable_candidates": reusable,
    }


def aggregate_offcuts(panel_offcuts: list[dict]) -> dict:
    largest = max(
        (offcut["largest_reusable_rect"] for offcut in panel_offcuts),
        key=lambda rect: rect["area_mm2"],
        default={"width_mm": 0.0, "height_mm": 0.0, "area_mm2": 0.0},
    )
    return {
        "waste_area_mm2": round(sum(offcut["waste_area_mm2"] for offcut in panel_offcuts), 3),
        "scrap_area_mm2": round(sum(offcut["scrap_area_mm2"] for offcut in panel_offcuts), 3),
        "fragmentation_penalty": round(sum(offcut["fragmentation_penalty"] for offcut in panel_offcuts), 3),
        "largest_reusable_rect": largest,
    }


def placements_to_json(placements: list[Placement]) -> list[dict]:
    return [
        {
            "piece_id": placement.piece_id,
            "part_name": placement.part_name,
            "x_mm": round(placement.x, 3),
            "y_mm": round(placement.y, 3),
            "width_mm": round(placement.width, 3),
            "height_mm": round(placement.height, 3),
            "rotated": placement.rotated,
        }
        for placement in placements
    ]


def calculate_strategy_plan(
    *,
    parts: list[Part],
    panel: PanelCandidate,
    spacing: float,
    allow_rotate: bool,
    strategy: str,
) -> dict:
    all_pieces = expand_pieces(parts)
    total_quantity = len(all_pieces)
    total_part_area = sum(piece.area_mm2 for piece in all_pieces)

    cannot_fit = [piece.id for piece in all_pieces if not can_piece_fit(piece, panel, allow_rotate)]
    if cannot_fit:
        return {
            "strategy": strategy,
            "canFitAll": False,
            "panelsNeeded": 0,
            "score": INVALID_SCORE,
            "score_label": "Infinity",
            "error": "pieces do not fit on panel: " + ", ".join(cannot_fit[:8]),
        }

    remaining = sorted_pieces(all_pieces, strategy)
    layout_panels: list[dict] = []
    placed_counts: dict[str, int] = {part.name: 0 for part in parts}

    while remaining and len(layout_panels) < MAX_PANELS:
        ordered = sorted_pieces(remaining, strategy)
        placements, placed_ids = pack_single_panel(
            ordered,
            panel,
            spacing=spacing,
            allow_rotate=allow_rotate,
        )
        if not placements:
            break
        offcut = analyze_offcuts(placements, panel)
        layout_panels.append(
            {
                "panel_index": len(layout_panels) + 1,
                "placements": placements_to_json(placements),
                "offcut": offcut,
            }
        )
        for placement in placements:
            placed_counts[placement.part_name] = placed_counts.get(placement.part_name, 0) + 1
        remaining = [piece for piece in remaining if piece.id not in placed_ids]

    can_fit_all = not remaining
    panels_needed = len(layout_panels) if layout_panels else 0
    panel_offcuts = [layout["offcut"] for layout in layout_panels]
    aggregate = aggregate_offcuts(panel_offcuts)
    waste_area = aggregate["waste_area_mm2"] if panel_offcuts else panel.area_mm2 * max(1, panels_needed)
    largest_reusable_area = aggregate["largest_reusable_rect"]["area_mm2"]
    score = (
        (0 if can_fit_all else 10_000_000_000)
        + panels_needed * 1_000_000_000
        + waste_area
        + aggregate["scrap_area_mm2"] * 1.5
        + aggregate["fragmentation_penalty"]
        - largest_reusable_area * 0.6
    )
    efficiency = (total_part_area / (panel.area_mm2 * panels_needed) * 100) if panels_needed else 0.0

    return {
        "strategy": strategy,
        "panel": {
            "name": panel.name,
            "width_mm": panel.width,
            "height_mm": panel.height,
            "basis": panel.basis,
        },
        "piecesPerPanel": round(total_quantity / panels_needed, 3) if panels_needed else 0,
        "panelsNeeded": panels_needed,
        "estimated_sheet_count": panels_needed,
        "efficiency": round(efficiency, 2),
        "yield_percent": round(efficiency, 2),
        "wasteArea": round(waste_area, 3),
        "waste_area_mm2": round(waste_area, 3),
        "canFitAll": can_fit_all,
        "placedCounts": placed_counts,
        "offcut": aggregate,
        "layoutPanels": layout_panels,
        "score": round(score, 3) if math.isfinite(score) else math.inf,
        "unplaced_count": len(remaining),
    }


def calculate_yield_plan(
    *,
    parts: list[Part],
    panel: PanelCandidate,
    spacing: float,
    allow_rotate: bool,
) -> dict:
    strategy_results = [
        calculate_strategy_plan(
            parts=parts,
            panel=panel,
            spacing=spacing,
            allow_rotate=allow_rotate,
            strategy=strategy,
        )
        for strategy in STRATEGIES
    ]
    best = min(strategy_results, key=lambda result: result["score"])
    total_quantity, total_part_area = area_totals(parts)
    area_min_sheet_count = math.ceil(total_part_area / panel.area_mm2)
    output = {
        **best,
        "method": "heuristic_nesting",
        "best_strategy": best["strategy"],
        "spacing_mm": spacing,
        "total_quantity": total_quantity,
        "total_part_area_mm2": round(total_part_area, 3),
        "total_part_area_m2": round(total_part_area / 1_000_000, 6),
        "stock_area_mm2": round(panel.area_mm2, 3),
        "area_min_sheet_count": area_min_sheet_count,
        "placement_over_area_min_sheet_count": max(0, best["panelsNeeded"] - area_min_sheet_count),
        "scrap_percent": round(100 - best["efficiency"], 2) if best["panelsNeeded"] else 100.0,
        "strategy_results": [
            {
                "strategy": result["strategy"],
                "panelsNeeded": result["panelsNeeded"],
                "efficiency": result.get("efficiency", 0),
                "wasteArea": result.get("wasteArea", 0),
                "score": result["score"],
                "canFitAll": result["canFitAll"],
            }
            for result in strategy_results
        ],
        "warnings": [
            "Heuristic nesting result; not a global optimum or production CAM layout.",
            "Staff review is required for complex, high-volume, direction-sensitive, or expensive materials.",
        ],
    }
    if any(part.shape != "rect" for part in parts):
        output["method"] = "bounding_box_heuristic"
        output["warnings"].append(
            "Non-rectangular parts use actual area for yield and bounding-box size for collision/placement."
        )
    if output["placement_over_area_min_sheet_count"] > 0:
        output["warnings"].append(
            f"Placement estimate is {output['placement_over_area_min_sheet_count']} sheet(s) above the area-only minimum."
        )
    return output


def compare_recommendations(a: dict, b: dict) -> int:
    if a.get("canFitAll") != b.get("canFitAll"):
        return -1 if a.get("canFitAll") else 1

    for key, direction in (
        ("panelsNeeded", 1),
        ("wasteArea", 1),
    ):
        diff = a.get(key, 0) - b.get(key, 0)
        should_compare = abs(diff) > 1000 if key == "wasteArea" else diff != 0
        if should_compare:
            return -1 if diff * direction < 0 else 1

    largest_a = a.get("offcut", {}).get("largest_reusable_rect", {}).get("area_mm2", 0)
    largest_b = b.get("offcut", {}).get("largest_reusable_rect", {}).get("area_mm2", 0)
    if abs(largest_a - largest_b) > 1000:
        return -1 if largest_a > largest_b else 1

    eff_diff = a.get("efficiency", 0) - b.get("efficiency", 0)
    if abs(eff_diff) > 1:
        return -1 if eff_diff > 0 else 1

    score_diff = a.get("score", math.inf) - b.get("score", math.inf)
    if score_diff == 0:
        return 0
    return -1 if score_diff < 0 else 1


def compare_combinations(a: dict, b: dict) -> int:
    for key in ("totalPanels", "totalWasteArea"):
        diff = a.get(key, 0) - b.get(key, 0)
        should_compare = abs(diff) > 1000 if key == "totalWasteArea" else diff != 0
        if should_compare:
            return -1 if diff < 0 else 1
    score_diff = a.get("score", INVALID_SCORE) - b.get("score", INVALID_SCORE)
    if score_diff == 0:
        return 0
    return -1 if score_diff < 0 else 1


def calculate_combination_plan(
    *,
    parts: list[Part],
    first_panel: PanelCandidate,
    second_panel: PanelCandidate,
    spacing: float,
    allow_rotate: bool,
) -> dict | None:
    all_pieces = expand_pieces(parts)
    part_lookup = {part.name: part for part in parts}
    total_part_area = sum(piece.area_mm2 for piece in all_pieces)
    total_quantity = len(all_pieces)
    best_combo: dict | None = None

    for strategy in STRATEGIES:
        ordered = sorted_pieces(all_pieces, strategy)
        first_placements, first_placed_ids = pack_single_panel(
            ordered,
            first_panel,
            spacing=spacing,
            allow_rotate=allow_rotate,
        )
        if not first_placements:
            continue

        remaining = [piece for piece in all_pieces if piece.id not in first_placed_ids]
        if not remaining:
            continue

        remaining_parts = parts_from_pieces(remaining, part_lookup)
        second_plan = calculate_yield_plan(
            parts=remaining_parts,
            panel=second_panel,
            spacing=spacing,
            allow_rotate=allow_rotate,
        )
        if not second_plan.get("canFitAll"):
            continue

        first_offcut = analyze_offcuts(first_placements, first_panel)
        second_offcuts = [layout["offcut"] for layout in second_plan.get("layoutPanels", [])]
        aggregate = aggregate_offcuts([first_offcut, *second_offcuts])
        total_panels = 1 + second_plan["panelsNeeded"]
        total_panel_area = first_panel.area_mm2 + (second_panel.area_mm2 * second_plan["panelsNeeded"])
        efficiency = (total_part_area / total_panel_area * 100) if total_panel_area else 0.0
        score = (
            total_panels * 1_000_000_000
            + aggregate["waste_area_mm2"]
            + aggregate["scrap_area_mm2"] * 1.5
            - aggregate["largest_reusable_rect"]["area_mm2"] * 0.6
        )
        layout_panels = [
            {
                "panel_index": 1,
                "panel_name": first_panel.name,
                "placements": placements_to_json(first_placements),
                "offcut": first_offcut,
            }
        ]
        for index, layout in enumerate(second_plan.get("layoutPanels", []), start=2):
            layout_panels.append(
                {
                    "panel_index": index,
                    "panel_name": second_panel.name,
                    "placements": layout["placements"],
                    "offcut": layout["offcut"],
                }
            )

        combo = {
            "type": "panel_combination",
            "strategy": strategy,
            "panels": [
                {"name": first_panel.name, "width_mm": first_panel.width, "height_mm": first_panel.height, "quantity": 1},
                {
                    "name": second_panel.name,
                    "width_mm": second_panel.width,
                    "height_mm": second_panel.height,
                    "quantity": second_plan["panelsNeeded"],
                },
            ],
            "totalPanels": total_panels,
            "totalWasteArea": aggregate["waste_area_mm2"],
            "efficiency": round(efficiency, 2),
            "yield_percent": round(efficiency, 2),
            "offcut": aggregate,
            "layoutPanels": layout_panels,
            "placedCounts": {
                part.name: part.quantity for part in parts
            },
            "score": round(score, 3),
            "warnings": [
                "Combination heuristic: first panel is packed once, then remaining pieces are packed on the second panel type.",
                "This is not an exhaustive multi-panel optimization.",
            ],
        }
        if best_combo is None or compare_combinations(combo, best_combo) < 0:
            best_combo = combo

    return best_combo


def build_combination_recommendations(
    *,
    parts: list[Part],
    panels: list[PanelCandidate],
    single_recommendations: list[dict],
    spacing: float,
    allow_rotate: bool,
) -> list[dict]:
    panel_by_name = {panel.name: panel for panel in panels}
    top_panel_names = []
    for recommendation in single_recommendations:
        name = recommendation.get("panel", {}).get("name")
        if recommendation.get("canFitAll") and name in panel_by_name and name not in top_panel_names:
            top_panel_names.append(name)
        if len(top_panel_names) >= 5:
            break
    top_panels = [panel_by_name[name] for name in top_panel_names]

    combos: list[dict] = []
    for first_panel in top_panels:
        for second_panel in top_panels:
            if first_panel.name == second_panel.name:
                continue
            combo = calculate_combination_plan(
                parts=parts,
                first_panel=first_panel,
                second_panel=second_panel,
                spacing=spacing,
                allow_rotate=allow_rotate,
            )
            if combo is not None:
                combos.append(combo)
    combos.sort(key=cmp_to_key(compare_combinations))
    return combos


def build_panel_candidates(args: argparse.Namespace, thickness: float | None) -> list[PanelCandidate]:
    candidates: list[PanelCandidate] = []
    if args.stock:
        width, height = args.stock
        if args.stock_orientation in ("normal", "both"):
            candidates.append(PanelCandidate("stock", width, height, "manual_stock"))
        if args.stock_orientation in ("swapped", "both") and width != height:
            candidates.append(PanelCandidate("stock_swapped", height, width, "manual_stock_swapped"))
    for panel in args.panel:
        candidates.append(panel)
    for preset in args.preset:
        width, height = adjusted_preset_size(preset, thickness)
        candidates.append(PanelCandidate(preset, width, height, "fallback_preset"))
    if args.all_presets:
        for preset in BASE_SIZE_MAPPING:
            width, height = adjusted_preset_size(preset, thickness)
            candidates.append(PanelCandidate(preset, width, height, "fallback_preset"))

    unique: dict[tuple[str, float, float], PanelCandidate] = {}
    for candidate in candidates:
        unique[(candidate.name, candidate.width, candidate.height)] = candidate
    result = list(unique.values())
    result.sort(key=lambda panel: panel.area_mm2)
    return result


def run_for_rotation_mode(
    *,
    parts: list[Part],
    panels: list[PanelCandidate],
    spacing: float,
    allow_rotate: bool,
    rotation_mode: str,
    include_combinations: bool = False,
) -> dict:
    recommendations = [
        calculate_yield_plan(parts=parts, panel=panel, spacing=spacing, allow_rotate=allow_rotate)
        for panel in panels
    ]
    recommendations.sort(key=cmp_to_key(compare_recommendations))
    output = {
        "rotation_mode": rotation_mode,
        "recommendations": recommendations,
        "best_recommendation": recommendations[0] if recommendations else None,
    }
    if include_combinations and len(panels) > 1:
        combinations = build_combination_recommendations(
            parts=parts,
            panels=panels,
            single_recommendations=recommendations,
            spacing=spacing,
            allow_rotate=allow_rotate,
        )
        output["combination_recommendations"] = combinations
        output["best_combination"] = combinations[0] if combinations else None
    return output


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Estimate acrylic yield using ACBANK heuristic nesting logic."
    )
    parser.add_argument("--stock", type=parse_size, help="Single stock size as WIDTHxHEIGHT in mm.")
    parser.add_argument(
        "--stock-orientation",
        choices=["normal", "swapped", "both"],
        default="normal",
        help="Also test HEIGHTxWIDTH when stock orientation is unclear.",
    )
    parser.add_argument(
        "--panel",
        action="append",
        type=parse_panel,
        default=[],
        help="Candidate panel as NAME:WIDTHxHEIGHT in mm. Repeat for multiple candidates.",
    )
    parser.add_argument(
        "--preset",
        action="append",
        default=[],
        help="Fallback panel preset, e.g. '대3*6' or '4*8'. Repeat for multiple presets.",
    )
    parser.add_argument("--all-presets", action="store_true", help="Evaluate all fallback panel presets.")
    parser.add_argument(
        "--logic-candidates",
        action="store_true",
        dest="all_presets",
        help="Alias for --all-presets. Evaluate only the current internal fallback auto recommendation candidates.",
    )
    parser.add_argument("--include-combinations", action="store_true", help="Also calculate two-panel combination recommendations.")
    parser.add_argument(
        "--part",
        action="append",
        type=parse_part,
        default=[],
        help="Rectangle as NAME:WIDTHxHEIGHTxQTY in mm. Repeat for mixed parts.",
    )
    parser.add_argument(
        "--trapezoid",
        action="append",
        type=parse_trapezoid,
        default=[],
        help="Simple trapezoid as NAME:TOPxBOTTOMxHEIGHTxQTY in mm. Uses max(TOP,BOTTOM)xHEIGHT bounding box.",
    )
    parser.add_argument("--thickness", help="Material thickness, e.g. 5T. Controls default spacing.")
    parser.add_argument("--spacing", type=float, help="Explicit spacing between pieces in mm.")
    parser.add_argument("--kerf", type=float, help="Backward-compatible alias for explicit spacing in mm.")
    parser.add_argument(
        "--allow-rotate",
        choices=["no", "yes", "both"],
        default="yes",
        help="Whether rotation is allowed. Internal heuristic default is yes.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    parts = [*args.part, *args.trapezoid]
    if not parts:
        parser.error("provide at least one --part or --trapezoid")
    if args.spacing is not None and args.spacing < 0:
        parser.error("--spacing must be zero or positive")
    if args.kerf is not None and args.kerf < 0:
        parser.error("--kerf must be zero or positive")

    thickness = parse_thickness(args.thickness)
    spacing, spacing_basis = spacing_from_inputs(
        thickness=thickness,
        spacing=args.spacing,
        kerf=args.kerf,
    )
    panels = build_panel_candidates(args, thickness)
    panel_basis = candidate_basis(args)
    evaluated_panels = [panel_to_json(panel) for panel in panels]

    if not panels:
        area_result = area_only_result(parts)
        area_result["candidate_basis"] = panel_basis
        area_result["evaluated_panels"] = []
        print(json.dumps(area_result, ensure_ascii=False, indent=2))
        return 0

    if args.allow_rotate == "both":
        result = {
            "mode": "heuristic_nesting",
            "candidate_basis": panel_basis,
            "evaluated_panels": evaluated_panels,
            "spacing_mm": spacing,
            "spacing_basis": spacing_basis,
            "rotation_scenarios": {
                "no_rotation": run_for_rotation_mode(
                    parts=parts,
                    panels=panels,
                    spacing=spacing,
                    allow_rotate=False,
                    rotation_mode="no",
                    include_combinations=args.include_combinations,
                ),
                "rotation_allowed": run_for_rotation_mode(
                    parts=parts,
                    panels=panels,
                    spacing=spacing,
                    allow_rotate=True,
                    rotation_mode="yes",
                    include_combinations=args.include_combinations,
                ),
            },
        }
    else:
        result = {
            "mode": "heuristic_nesting",
            "candidate_basis": panel_basis,
            "evaluated_panels": evaluated_panels,
            "spacing_mm": spacing,
            "spacing_basis": spacing_basis,
            **run_for_rotation_mode(
                parts=parts,
                panels=panels,
                spacing=spacing,
                allow_rotate=args.allow_rotate == "yes",
                rotation_mode=args.allow_rotate,
                include_combinations=args.include_combinations,
            ),
        }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
