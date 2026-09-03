import type { WordHeaderFooterDTO, WordLayoutDTO, WordSelectionDTO, WordStatsDTO } from '../types/dto';
import type { WordVibeEventMap } from './events';

export interface WordVibeOptions {
  host: HTMLElement;
  editable?: boolean;
  initialContent?: string;
  initialLayout?: Partial<WordLayoutDTO>;
  initialHeaderFooter?: WordHeaderFooterDTO;
  chapterTitle?: string;
  imageUploadHandler?: (file: File) => Promise<string>;
}

export interface WordVibeAdapter {
  /* Lifecycle */
  mount(options: WordVibeOptions): void;
  isReady(): boolean;
  unmount(): void;

  /* Content */
  setContent(content: string): void;
  getContent(): string;

  /* Focus */
  focus(): void;
  blur(): void;

  /* Commands */
  execCommand(name: string, ...args: unknown[]): boolean;
  getCommandNames(): readonly string[];

  /* Selection and state */
  getSelection(): WordSelectionDTO | null;

  /* Page geometry & headers/footers */
  setLayout(layout: Partial<WordLayoutDTO>): void;
  getLayout(): WordLayoutDTO;
  setHeaderFooter(hf: WordHeaderFooterDTO): void;

  /* Stats */
  getStats(): WordStatsDTO;

  /* Export & print */
  exportDocx(filename?: string): Promise<void>;
  printPdf(title?: string): void;

  /* Events */
  on<K extends keyof WordVibeEventMap>(event: K, cb: (payload: WordVibeEventMap[K]) => void): () => void;
}
