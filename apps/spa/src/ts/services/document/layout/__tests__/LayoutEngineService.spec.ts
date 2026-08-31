import { describe, expect, it } from 'vitest';
import { AcademicGOSTProfile, NovelBookProfile } from '../../profiles/defaults';
import { LayoutEngineService } from '../LayoutEngineService';

describe('LayoutEngineService', () => {
  it('computes physical A4 dimensions and GOST margins in pixels', () => {
    const dim = LayoutEngineService.computeDimensions(AcademicGOSTProfile.page);

    expect(dim.widthMm).toBe(210);
    expect(dim.heightMm).toBe(297);
    expect(dim.widthPx).toBe(794);  // 210 * 3.7795
    expect(dim.heightPx).toBe(1123); // 297 * 3.7795

    // ГОСТ поля: 30 мм левое, 10 мм правое, 20 мм верх, 20 мм низ
    expect(dim.marginsPx.left).toBe(113); // 30 * 3.7795 ≈ 113
    expect(dim.marginsPx.right).toBe(38); // 10 * 3.7795 ≈ 38
    expect(dim.marginsPx.top).toBe(76);   // 20 * 3.7795 ≈ 76
    expect(dim.marginsPx.bottom).toBe(76);
  });

  it('computes A5 dimensions for novel book profile', () => {
    const dim = LayoutEngineService.computeDimensions(NovelBookProfile.page);

    expect(dim.widthMm).toBe(148);
    expect(dim.heightMm).toBe(210);
    expect(dim.widthPx).toBe(559);
    expect(dim.heightPx).toBe(794);
  });

  it('builds PaginationPlus runtime configuration for GOST with top-right page numbers', () => {
    const config = LayoutEngineService.buildPaginationConfig({
      page: AcademicGOSTProfile.page,
      headersFooters: AcademicGOSTProfile.headersFooters,
      documentTitle: 'Курсовая работа'
    });

    expect(config.enabled).toBe(true);
    expect(config.headerRight).toBe('{page}');
    expect(config.headerLeft).toBe('Курсовая работа');
    expect(config.marginLeft).toBe(113);
    expect(config.marginRight).toBe(38);
  });

  it('disables pagination when requested for Write Mode', () => {
    const config = LayoutEngineService.buildPaginationConfig({
      page: AcademicGOSTProfile.page,
      headersFooters: AcademicGOSTProfile.headersFooters,
      enabled: false
    });

    expect(config.enabled).toBe(false);
  });
});
