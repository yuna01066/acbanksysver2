export interface ColorOptionAttributes {
  color_family?: string;
  material_series?: string;
  finish_type?: string;
  texture_type?: string;
  visual_opacity_percent?: number;
  white_pigment_percent?: number;
  transparency_percent?: number;
  is_white_opacity_reference?: boolean;
  equivalent_to?: string;
  reference_note?: string;
  white_base_code?: string;
  white_base_visual_opacity_percent?: number;
  white_base_pigment_percent?: number;
  requires_bright_pigment_surcharge?: boolean;
}

export interface ColorAttributeLike {
  is_bright_pigment?: boolean;
  color_attribute_note?: string | null;
  attributes?: ColorOptionAttributes | null;
}

export const getColorAttributes = (
  attributes?: ColorOptionAttributes | Record<string, unknown> | null
): ColorOptionAttributes => {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return {};
  return attributes as ColorOptionAttributes;
};

export const isWhiteOpacityReference = (color: ColorAttributeLike) =>
  getColorAttributes(color.attributes).is_white_opacity_reference === true;

export const isBrightPigmentColor = (color: ColorAttributeLike) => {
  const attributes = getColorAttributes(color.attributes);
  return color.is_bright_pigment === true || attributes.requires_bright_pigment_surcharge === true;
};

export const getTextureLabel = (textureType?: string) => {
  switch (textureType) {
    case 'satin_matte':
      return '사틴 텍스처';
    case 'astel':
      return '아스텔 텍스처';
    case 'none':
      return null;
    default:
      return textureType || null;
  }
};

export const getColorAttributeBadges = (color: ColorAttributeLike): string[] => {
  const attributes = getColorAttributes(color.attributes);
  const badges: string[] = [];

  if (attributes.is_white_opacity_reference) {
    badges.push('화이트 기준');
  }

  if (typeof attributes.visual_opacity_percent === 'number') {
    badges.push(`투명도 ${attributes.visual_opacity_percent}%`);
  }

  if (typeof attributes.white_pigment_percent === 'number' && attributes.white_pigment_percent > 0) {
    badges.push(`백색 안료 ${attributes.white_pigment_percent}%`);
  }

  const textureLabel = getTextureLabel(attributes.texture_type);
  if (textureLabel) {
    badges.push(textureLabel);
  }

  if (attributes.equivalent_to) {
    badges.push(`${attributes.equivalent_to} 계열`);
  }

  if (isBrightPigmentColor(color)) {
    badges.push('화이트 안료 추가');
    badges.push(`스리/진백 기준 ${attributes.white_base_code || 'AC-B004'}`);
  }

  return badges;
};

export const getColorSelectionTypeLabel = (color: ColorAttributeLike) => {
  if (isBrightPigmentColor(color)) return '화이트 안료 추가';

  const attributes = getColorAttributes(color.attributes);
  if (attributes.is_white_opacity_reference && typeof attributes.visual_opacity_percent === 'number') {
    return `화이트 기준 ${attributes.visual_opacity_percent}%`;
  }

  return '';
};

export const getColorSearchTokens = (color: ColorAttributeLike) => {
  const attributes = getColorAttributes(color.attributes);
  return [
    attributes.color_family,
    attributes.material_series,
    attributes.finish_type,
    attributes.texture_type,
    attributes.equivalent_to,
    attributes.white_base_code,
    attributes.reference_note,
    color.color_attribute_note,
    ...getColorAttributeBadges(color),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};
