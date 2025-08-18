
import { MATERIALS, CASTING_QUALITIES, SURFACE_OPTIONS } from "@/types/calculator";
import { createPriceKey } from "@/types/pricing";

export interface PriceCombination {
  key: string;
  material: string;
  quality: string;
  thickness: string;
  size: string;
  surface: string;
  colorType?: string;
}

export const generateAllCombinations = (): PriceCombination[] => {
  const combinations: PriceCombination[] = [];

  MATERIALS.forEach(material => {
    if (material.id === 'casting') {
      CASTING_QUALITIES.forEach(quality => {
        quality.thicknesses.forEach(thickness => {
          quality.sizes.forEach(size => {
            SURFACE_OPTIONS.forEach(surface => {
              if (quality.id === 'glossy-standard') {
                // 유광 보급판은 컬러/진백 옵션 모두 생성
                ['컬러', '진백'].forEach(colorType => {
                  const key = createPriceKey(material.id, quality.id, thickness, size, surface.name, colorType);
                  combinations.push({
                    key,
                    material: material.name,
                    quality: quality.name,
                    thickness,
                    size,
                    surface: surface.name,
                    colorType
                  });
                });
              } else {
                // 다른 재질은 기존과 동일
                const key = createPriceKey(material.id, quality.id, thickness, size, surface.name);
                combinations.push({
                  key,
                  material: material.name,
                  quality: quality.name,
                  thickness,
                  size,
                  surface: surface.name
                });
              }
            });
          });
        });
      });
    }
  });

  return combinations;
};
