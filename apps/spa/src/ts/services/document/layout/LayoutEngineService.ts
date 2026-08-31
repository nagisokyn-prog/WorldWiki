import type { PageProfile } from '../profiles/types';
import type { ComputedPageDimensions, LayoutServiceOptions, PaginationRuntimeConfig } from './types';

export const MM_TO_PX = 96 / 25.4; // Standard 96 DPI CSS conversion factor (approx 3.7795)

/**
 * Pure calculation service translating DocumentProfile page settings
 * into exact physical pixel geometries and PaginationPlus options.
 */
export class LayoutEngineService {
  /**
   * Computes physical page dimensions and margins in pixels.
   */
  public static computeDimensions(page: PageProfile): ComputedPageDimensions {
    let widthMm = 210;
    let heightMm = 297;

    switch (page.format) {
      case 'A4':
        widthMm = 210;
        heightMm = 297;
        break;
      case 'A5':
        widthMm = 148;
        heightMm = 210;
        break;
      case 'B5':
        widthMm = 176;
        heightMm = 250;
        break;
      case 'Letter':
        widthMm = 215.9;
        heightMm = 279.4;
        break;
      case 'Custom':
      default:
        widthMm = 210;
        heightMm = 297;
        break;
    }

    if (page.orientation === 'landscape') {
      const temp = widthMm;
      widthMm = heightMm;
      heightMm = temp;
    }

    const widthPx = Math.round(widthMm * MM_TO_PX);
    const heightPx = Math.round(heightMm * MM_TO_PX);

    return {
      widthMm,
      heightMm,
      widthPx,
      heightPx,
      marginsPx: {
        top: Math.round(page.margins.topMm * MM_TO_PX),
        bottom: Math.round(page.margins.bottomMm * MM_TO_PX),
        left: Math.round(page.margins.leftMm * MM_TO_PX),
        right: Math.round(page.margins.rightMm * MM_TO_PX)
      }
    };
  }

  /**
   * Builds the runtime configuration object for PaginationPlus extension.
   */
  public static buildPaginationConfig(options: LayoutServiceOptions): PaginationRuntimeConfig {
    const dim = this.computeDimensions(options.page);
    const hf = options.headersFooters;

    let headerRight = '';
    let headerLeft = '';
    let footerRight = '';
    let footerLeft = '';

    if (hf.showPageNumber) {
      switch (hf.pageNumberPosition) {
        case 'top-right':
          headerRight = '{page}';
          headerLeft = options.documentTitle ? options.documentTitle : '';
          break;
        case 'top-center':
          headerRight = '';
          headerLeft = '{page}';
          break;
        case 'bottom-center':
        case 'bottom-right':
          footerRight = '{page}';
          break;
        case 'none':
        default:
          break;
      }
    }

    return {
      enabled: options.enabled ?? true,
      pageWidth: dim.widthPx,
      pageHeight: dim.heightPx,
      marginTop: dim.marginsPx.top,
      marginBottom: dim.marginsPx.bottom,
      marginLeft: dim.marginsPx.left,
      marginRight: dim.marginsPx.right,
      headerRight,
      headerLeft,
      footerRight,
      footerLeft
    };
  }
}
