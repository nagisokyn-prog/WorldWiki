/**
 * @file footnote.service.ts
 * @description Сервис для работы с сносками
 * @note DOM-зависимый
 */

interface FootnoteData {
  id: number;
  text: string;
  createdAt: string;
}

class FootnoteService {
  footnotes: Record<number, FootnoteData> = {};
  counter: number = 1;
  onUpdate: ((footnotes: Record<number, FootnoteData>) => void) | null = null;

  load(footnotes: Record<number, FootnoteData> | undefined): void {
    this.footnotes = footnotes || {};
    const ids = Object.keys(this.footnotes).map(Number);
    this.counter = ids.length ? Math.max(...ids) + 1 : 1;
    this.notifyUpdate();
  }

  getFootnotes(): Record<number, FootnoteData> {
    return this.footnotes;
  }

  add(text: string): number {
    const id = this.counter++;
    this.footnotes[id] = { id, text, createdAt: new Date().toISOString() };
    this.notifyUpdate();
    return id;
  }

  remove(id: number): boolean {
    if (this.footnotes[id]) {
      delete this.footnotes[id];
      this.notifyUpdate();
      return true;
    }
    return false;
  }

  generateMarkdown(id: number, text: string): string {
    return `[^${id}]\n\n[^${id}]: ${text.trim()}`;
  }

  removeFromMarkdown(content: string, id: number): string {
    let result = content.replace(new RegExp(`\\[\\^${id}\\]`, 'g'), '');
    result = result.replace(new RegExp(`\\[\\^${id}\\]:.*\n?`, 'g'), '');
    return result;
  }

  notifyUpdate(): void {
    if (this.onUpdate) this.onUpdate(this.footnotes);
  }
}

export const footnoteService = new FootnoteService();

declare global {
  interface Window {
    footnoteService: FootnoteService;
  }
}

if (typeof window !== 'undefined') {
  window.footnoteService = footnoteService;
}