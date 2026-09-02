import type { PageSize, Orientation } from './RkWordEditor.model';

/** px на 1mm при 96 DPI */
export const PX_PER_MM = 96 / 25.4;

export const GOST_MARGINS_MM = {
  top: 20,
  bottom: 20,
  left: 30,
  right: 15,
} as const;

/** Габариты листа в px (96 DPI), книжная ориентация */
const PAGE_DIMS_PX: Record<string, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  A5: { width: 559, height: 794 },
  A3: { width: 1123, height: 1587 },
  B5: { width: 665, height: 945 },
  Letter: { width: 816, height: 1056 },
  Legal: { width: 816, height: 1404 },
  Tabloid: { width: 1060, height: 1635 },
};

export interface PaginationGeometry {
  pageSize: PageSize;
  orientation: Orientation;
  marginsMm?: { top: number; bottom: number; left: number; right: number };
}

export interface PaginationPageConfig {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

const mmToPx = (mm: number) => Math.round(mm * PX_PER_MM);

/** Пересчёт формата/ориентации/полей в пиксельную геометрию страницы */
export function getPageGeometry(geometry: PaginationGeometry): PaginationPageConfig {
  const dims = PAGE_DIMS_PX[geometry.pageSize] || PAGE_DIMS_PX.A4;
  const landscape = geometry.orientation === 'landscape';
  const m = geometry.marginsMm || GOST_MARGINS_MM;
  return {
    pageWidth: landscape ? dims.height : dims.width,
    pageHeight: landscape ? dims.width : dims.height,
    marginTop: mmToPx(m.top),
    marginBottom: mmToPx(m.bottom),
    marginLeft: mmToPx(m.left),
    marginRight: mmToPx(m.right),
  };
}
