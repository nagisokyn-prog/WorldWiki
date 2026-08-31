import type { HeaderFooterProfile, PageProfile } from '../profiles/types';

/**
 * Layout configuration contracts for physical A4 page rendering.
 */

export interface ComputedPageDimensions {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  marginsPx: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface PaginationRuntimeConfig {
  enabled: boolean;
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerRight: string;
  headerLeft: string;
  footerRight: string;
  footerLeft: string;
}

export interface LayoutServiceOptions {
  page: PageProfile;
  headersFooters: HeaderFooterProfile;
  documentTitle?: string;
  enabled?: boolean;
}
