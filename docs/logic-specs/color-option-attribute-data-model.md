# 컬러 속성 데이터 모델 1차 기준서

## 목적

견적 계산기와 원판 관리에서 컬러를 단순 이름으로만 다루지 않고, 재질/텍스처/백색 안료/투명도/가격 적용 조건을 구조화한다.

1차 범위는 `color_options.attributes` JSONB에 속성 데이터를 저장하는 방식이다. 기존 견적 금액과 저장된 계산 스냅샷은 재계산하지 않는다.

## 핵심 원칙

- `color_name`은 기존처럼 `AC-C011`, `AC-B164` 같은 화면 표시/검색용 코드로 유지한다.
- `color_code`는 기존처럼 HEX 또는 화면 swatch용 색상값으로 유지한다.
- `series_key`는 컬러 소스 시리즈 구분에 사용한다.
- `attributes`는 계산과 검수에 필요한 구조화 속성을 저장한다.
- `visual_opacity_percent`와 `white_pigment_percent`는 분리한다.
  - 예: `AC-B001`은 사틴 텍스처 때문에 반투명하게 보이지만, 백색 안료가 들어간 불투명 소재로 보지 않는다.

## AC-C / AC-B / AC-AS 001~006 기준

| 코드군 | 재질 의미 | 표면/텍스처 | 001 | 002 | 003 | 004 | 005 | 006 |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `AC-C001~006` | Clear 유광 화이트 투명도 기준 | 유광, 텍스처 없음 | 투명 | 20 | 40 | 60 | 80 | 100 불투명 |
| `AC-B001~006` | Satin texture 화이트/스리 기준 | 무광 사틴 텍스처 | 10 시각 반투명 | 20 | 40 | 60 | 80 | 100 불투명 |
| `AC-AS001~006` | Astel 화이트 투명도 기준 | 아스텔 텍스처 | 투명 | 20 | 40 | 60 | 80 | 100 불투명 |

`AC-B001`은 실질적으로 투명 아크릴에 무광 사틴 텍스처만 있는 소재다. `visual_opacity_percent`는 10으로 기록할 수 있지만, `white_pigment_percent`는 0으로 기록한다.

## Bright 기준

Bright 시리즈는 스리/진백 백색 안료 기준이 `AC-B004`다.

- 기준 베이스: `AC-B004`
- 기준 투명도/백색도: 60
- 가격 조건: Bright/스리/진백 추가금 대상
- 표면 의미: Bright 색상판 자체는 사틴 텍스처가 아니라, 백색 안료 베이스를 참조하는 색상판으로 다룬다.

## 권장 attributes 예시

### AC-B001

```json
{
  "schema_version": "color-attributes-v1-260527",
  "color_family": "white_opacity_reference",
  "material_series": "satin_texture",
  "finish_type": "satin_matte",
  "texture_type": "satin_matte",
  "visual_opacity_percent": 10,
  "white_pigment_percent": 0,
  "transparency_percent": 100,
  "is_white_opacity_reference": true,
  "equivalent_to": "AC-ST",
  "reference_note": "투명 아크릴에 무광 사틴 텍스처만 있는 기준. AC-ST 사틴 투명 계열과 동일하게 취급"
}
```

### AC-B004

```json
{
  "schema_version": "color-attributes-v1-260527",
  "color_family": "white_opacity_reference",
  "material_series": "satin_texture",
  "finish_type": "satin_matte",
  "texture_type": "satin_matte",
  "visual_opacity_percent": 60,
  "white_pigment_percent": 60,
  "transparency_percent": 40,
  "is_white_opacity_reference": true,
  "reference_note": "사틴 텍스처 백색도 60 기준. Bright 시리즈의 스리/진백 기준 베이스"
}
```

### Bright 색상

```json
{
  "schema_version": "color-attributes-v1-260527",
  "color_family": "bright_color",
  "material_series": "bright_pigment",
  "finish_type": "glossy",
  "texture_type": "none",
  "white_base_code": "AC-B004",
  "white_base_material_series": "satin_texture",
  "white_base_visual_opacity_percent": 60,
  "white_base_pigment_percent": 60,
  "requires_bright_pigment_surcharge": true
}
```

## 견적 계산 연결

| 재질 | 계산 기준 |
|---|---|
| Clear | `CLEAR 기본가 + 조색비` |
| Satin | `CLEAR 기본가 + 조색비 + 사틴 추가금 + 양단면 추가금` |
| Astel | `CLEAR 기본가 + 조색비 + 아스텔 추가금 + 양단면 추가금` |
| Bright | `CLEAR 기본가 + 조색비 + Bright/스리/진백 추가금 + 양단면 추가금` |
| Mirror 계열 | 재질 선택 단계에서 미러증착 비용 포함, 하드코팅은 후가공 옵션 |

## 1차 적용 범위

- `color_options.attributes jsonb` 컬럼 추가
- 기존에 존재하는 `AC-C001~006`, `AC-B001~006`, `AC-AS001~006` 행이 있으면 속성 보강
- `bright-color` 컬러 전체에 `AC-B004` 기준 베이스 속성 부여
- 기존 저장 견적 금액 재계산 없음

## 2차 후보

- `AC-C001~006`, `AC-B001~006`, `AC-AS001~006` 기준 컬러칩을 실제 선택 목록에 노출할지 결정
- 컬러 선택 UI에 `화이트 기준`, `A`, `B` 같은 시리즈 탭 구조 추가
- 관리자 컬러 관리 화면에 `attributes` 요약 표시
- 견적 계산기에서 `attributes.requires_bright_pigment_surcharge`를 직접 참고하도록 보강
