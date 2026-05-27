#!/usr/bin/env python3
"""Deterministic helper for the ACBANK quote formula v2 pipeline.

Input: JSON object with numeric fields. Missing optional fields default to 0
or to the formula baseline values below.

This script performs arithmetic only. It does not infer drawing facts.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any


def money(value: float) -> int:
    return int(round(value))


def round_to_100(value: float) -> int:
    return int(round(value / 100.0) * 100)


def number(data: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = data.get(key, default)
    if value is None or value == "":
        return default
    return float(value)


def bool_value(data: dict[str, Any], key: str, default: bool = False) -> bool:
    value = data.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def area_factor(area_mm2: float, base_area_mm2: float = 10_000.0) -> float:
    return max(1.0, math.ceil((area_mm2 / base_area_mm2) * 10.0) / 10.0)


def calculate(data: dict[str, Any]) -> dict[str, Any]:
    sheet_cost = number(data, "sheetCost")
    fabrication_base_multiplier = number(data, "fabricationBaseMultiplier", 1.3)
    selected_setup_fee = number(data, "selectedSetupFee")

    edge_length_m = number(data, "edgeLengthM")
    mirror_edge_rate_per_m = number(data, "mirrorEdgeRatePerM", 14_200)
    bulgwang_multiplier = number(data, "bulgwangEdgeMultiplier", 3.0)
    has_bulgwang = bool_value(data, "hasBulgwang")

    cnc_interlocking_slot_cost = number(data, "cncInterlockingSlotCost")
    if bool_value(data, "hasCncInterlockingSlot") and cnc_interlocking_slot_cost == 0:
        cnc_interlocking_slot_cost = number(data, "cncInterlockingSlotFee", 70_000)

    other_fabrication_cost = number(data, "otherFabricationCost")

    cut_base_cost = sheet_cost * fabrication_base_multiplier + selected_setup_fee
    mirror_edge_cost = edge_length_m * mirror_edge_rate_per_m
    bulgwang_cost = mirror_edge_cost * bulgwang_multiplier if has_bulgwang else 0.0

    fabrication_cost_basis = (
        cut_base_cost
        + mirror_edge_cost
        + bulgwang_cost
        + cnc_interlocking_slot_cost
        + other_fabrication_cost
    )

    assembly_loss_rate = number(data, "assemblyLossRate", 0.30 if bool_value(data, "hasInterlockingAssembly") else 0.0)
    assembly_loss_cost = fabrication_cost_basis * assembly_loss_rate

    target_margin_rate = number(data, "targetGrossMarginRate", 0.30)
    if target_margin_rate >= 1:
        raise ValueError("targetGrossMarginRate must be below 1.0")

    fabrication_sale_amount = (fabrication_cost_basis + assembly_loss_cost) / (1.0 - target_margin_rate)

    has_uv = bool_value(data, "hasUvBackPrint") or any(
        key in data
        for key in (
            "uvProductQty",
            "uvPrintAreaMm2",
            "uvSizeFactor",
            "uvPrintBaseFee",
            "uvSheetOutsourceUnitCost",
        )
    )
    uv_product_qty = number(data, "uvProductQty", number(data, "productQty") if has_uv else 0.0)
    uv_print_area_mm2 = number(data, "uvPrintAreaMm2")
    uv_size_factor = number(data, "uvSizeFactor", area_factor(uv_print_area_mm2) if uv_print_area_mm2 else 1.0)
    uv_print_base_fee = number(data, "uvPrintBaseFee")
    uv_service_cost = uv_product_qty * (
        (uv_print_base_fee + number(data, "uvSheetAttachBaseFee", 5_000) + number(data, "uvHandlingBaseFee", 10_000))
        * uv_size_factor
        + number(data, "uvBackSidePrintUnitSurcharge", 3_000)
    )

    uv_sheet_outsource_unit_cost = number(data, "uvSheetOutsourceUnitCost")
    uv_sheet_outsource_cost = uv_sheet_outsource_unit_cost * uv_product_qty
    uv_sheet_outsource_sale_amount = uv_sheet_outsource_cost / (1.0 - target_margin_rate)

    has_dye = bool_value(data, "hasDyeOutsource") or any(
        key in data
        for key in (
            "dyeProductQty",
            "dyeAreaMm2",
            "dyeSizeFactor",
            "dyeColorCount",
        )
    )
    dye_product_qty = number(data, "dyeProductQty", number(data, "productQty") if has_dye else 0.0)
    dye_area_mm2 = number(data, "dyeAreaMm2")
    dye_size_factor = number(data, "dyeSizeFactor", area_factor(dye_area_mm2) if dye_area_mm2 else 1.0)
    dye_color_count = number(data, "dyeColorCount", 1.0 if has_dye else 0.0)
    dye_outsource_cost = dye_product_qty * number(data, "dyeOutsource1ColorBaseFee", 30_000) * dye_size_factor * dye_color_count
    dye_outsource_sale_amount = dye_outsource_cost / (1.0 - target_margin_rate)

    pass_through_cost = number(data, "passThroughCost")
    manual_adjustment = number(data, "manualAdjustment")

    quote_subtotal_raw = (
        fabrication_sale_amount
        + uv_service_cost
        + uv_sheet_outsource_sale_amount
        + dye_outsource_sale_amount
        + pass_through_cost
        + manual_adjustment
    )
    subtotal = round_to_100(quote_subtotal_raw)
    tax_rate = number(data, "taxRate", 0.10)
    tax = money(subtotal * tax_rate)
    total = subtotal + tax

    return {
        "cutBaseCost": money(cut_base_cost),
        "mirrorEdgeCost": money(mirror_edge_cost),
        "bulgwangCost": money(bulgwang_cost),
        "cncInterlockingSlotCost": money(cnc_interlocking_slot_cost),
        "fabricationCostBasis": money(fabrication_cost_basis),
        "assemblyLossCost": money(assembly_loss_cost),
        "fabricationSaleAmount": money(fabrication_sale_amount),
        "uvServiceCost": money(uv_service_cost),
        "uvSheetOutsourceCost": money(uv_sheet_outsource_cost),
        "uvSheetOutsourceSaleAmount": money(uv_sheet_outsource_sale_amount),
        "dyeOutsourceCost": money(dye_outsource_cost),
        "dyeOutsourceSaleAmount": money(dye_outsource_sale_amount),
        "quoteSubtotalRaw": money(quote_subtotal_raw),
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: calculate_formula_v2.py <input.json>", file=sys.stderr)
        return 2
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    result = calculate(data)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
