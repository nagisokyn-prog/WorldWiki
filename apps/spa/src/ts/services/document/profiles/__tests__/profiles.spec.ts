import { describe, expect, it } from 'vitest';
import { AcademicGOSTProfile, ContinuousDraftProfile, DEFAULT_PROFILES, NovelBookProfile } from '../defaults';

describe('DocumentProfiles', () => {
  it('validates AcademicGOSTProfile compliance', () => {
    expect(AcademicGOSTProfile.page.format).toBe('A4');
    expect(AcademicGOSTProfile.page.margins.leftMm).toBe(30); // ГОСТ подшивка
    expect(AcademicGOSTProfile.page.margins.rightMm).toBe(10);
    expect(AcademicGOSTProfile.page.margins.topMm).toBe(20);
    expect(AcademicGOSTProfile.page.margins.bottomMm).toBe(20);

    expect(AcademicGOSTProfile.typography.fontFamily).toBe('Times New Roman');
    expect(AcademicGOSTProfile.typography.baseSizePt).toBe(14);
    expect(AcademicGOSTProfile.paragraph.lineHeight).toBe(1.5);
    expect(AcademicGOSTProfile.paragraph.firstLineIndentMm).toBe(12.5); // 1.25 см
    expect(AcademicGOSTProfile.paragraph.alignment).toBe('justify');

    expect(AcademicGOSTProfile.headersFooters.firstPageExcluded).toBe(true);
    expect(AcademicGOSTProfile.headersFooters.showPageNumber).toBe(true);
  });

  it('validates NovelBookProfile configuration', () => {
    expect(NovelBookProfile.page.format).toBe('A5');
    expect(NovelBookProfile.paragraph.lineHeight).toBe(1.35);
    expect(NovelBookProfile.paragraph.firstLineIndentMm).toBe(8.0);
    expect(NovelBookProfile.headersFooters.pageNumberPosition).toBe('bottom-center');
    expect(NovelBookProfile.numbering.headingNumberingEnabled).toBe(false);
  });

  it('validates ContinuousDraftProfile configuration', () => {
    expect(ContinuousDraftProfile.page.format).toBe('Custom');
    expect(ContinuousDraftProfile.headersFooters.showPageNumber).toBe(false);
    expect(ContinuousDraftProfile.paragraph.alignment).toBe('left');
  });

  it('contains all default profiles in registry', () => {
    expect(DEFAULT_PROFILES.gost_academic).toBeDefined();
    expect(DEFAULT_PROFILES.novel_book).toBeDefined();
    expect(DEFAULT_PROFILES.continuous_draft).toBeDefined();
  });
});
