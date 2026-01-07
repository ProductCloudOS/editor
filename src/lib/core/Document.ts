import { DocumentData, DocumentSettings, PageData } from '../types';
import { Page } from './Page';
import { EventEmitter } from '../events/EventEmitter';
import { FlowingTextContent } from '../text';

export class Document extends EventEmitter {
  private _pages: Page[] = [];
  private _settings: DocumentSettings;
  private _version: string = '1.0.0';
  private _headerFlowingContent: FlowingTextContent;
  private _footerFlowingContent: FlowingTextContent;

  constructor(data?: DocumentData) {
    super();

    // Initialize header and footer flowing content
    this._headerFlowingContent = new FlowingTextContent();
    this._footerFlowingContent = new FlowingTextContent();
    this.setupHeaderFooterListeners();

    if (data) {
      this._version = data.version || this._version;
      this._settings = data.settings || this.getDefaultSettings();
      data.pages.forEach(pageData => {
        this.addPage(new Page(pageData, this._settings));
      });

      // Load header/footer content if present
      if (data.headerContent?.text) {
        this._headerFlowingContent.setText(data.headerContent.text);
      }
      if (data.footerContent?.text) {
        this._footerFlowingContent.setText(data.footerContent.text);
      }
    } else {
      this._settings = this.getDefaultSettings();
      this.addPage(new Page(this.createEmptyPageData(), this._settings));
    }
  }

  private setupHeaderFooterListeners(): void {
    this._headerFlowingContent.on('content-changed', () => {
      this.emit('header-content-changed');
      this.emit('change');
    });

    this._footerFlowingContent.on('content-changed', () => {
      this.emit('footer-content-changed');
      this.emit('change');
    });
  }

  private getDefaultSettings(): DocumentSettings {
    return {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      units: 'mm'
    };
  }

  private createEmptyPageData(): PageData {
    return {
      id: this.generateId(),
      header: { height: 50, elements: [] },
      content: { elements: [] },
      footer: { height: 30, elements: [] }
    };
  }

  private generateId(): string {
    return `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  get pages(): Page[] {
    return this._pages;
  }

  get pageCount(): number {
    return this._pages.length;
  }

  get settings(): DocumentSettings {
    return { ...this._settings };
  }

  get version(): string {
    return this._version;
  }

  get headerFlowingContent(): FlowingTextContent {
    return this._headerFlowingContent;
  }

  get footerFlowingContent(): FlowingTextContent {
    return this._footerFlowingContent;
  }

  addPage(page: Page, index?: number): void {
    if (index !== undefined && index >= 0 && index <= this._pages.length) {
      this._pages.splice(index, 0, page);
    } else {
      this._pages.push(page);
    }

    page.on('change', () => this.handlePageChange());
    this.emit('page-added', { page, index });
    this.emit('change');
  }

  removePage(pageId: string): Page | null {
    const index = this._pages.findIndex(p => p.id === pageId);
    if (index === -1) return null;

    const [removedPage] = this._pages.splice(index, 1);
    removedPage.removeAllListeners();
    
    this.emit('page-removed', { page: removedPage, index });
    this.emit('change');
    
    return removedPage;
  }

  getPage(pageId: string): Page | undefined {
    return this._pages.find(p => p.id === pageId);
  }

  getPageByIndex(index: number): Page | undefined {
    return this._pages[index];
  }

  movePage(pageId: string, newIndex: number): boolean {
    const currentIndex = this._pages.findIndex(p => p.id === pageId);
    if (currentIndex === -1 || newIndex < 0 || newIndex >= this._pages.length) {
      return false;
    }

    const [page] = this._pages.splice(currentIndex, 1);
    this._pages.splice(newIndex, 0, page);
    
    this.emit('page-moved', { page, fromIndex: currentIndex, toIndex: newIndex });
    this.emit('change');
    
    return true;
  }

  updateSettings(settings: Partial<DocumentSettings>): void {
    this._settings = { ...this._settings, ...settings };
    
    this._pages.forEach(page => {
      page.updateSettings(this._settings);
    });
    
    this.emit('settings-changed', { settings: this._settings });
    this.emit('change');
  }

  private handlePageChange(): void {
    this.emit('change');
  }

  toData(): DocumentData {
    return {
      version: this._version,
      settings: this._settings,
      pages: this._pages.map(page => page.toData()),
      headerContent: {
        text: this._headerFlowingContent.getText()
      },
      footerContent: {
        text: this._footerFlowingContent.getText()
      }
    };
  }

  clear(): void {
    this._pages.forEach(page => page.removeAllListeners());
    this._pages = [];

    // Clear header and footer content
    this._headerFlowingContent.setText('');
    this._footerFlowingContent.setText('');

    this.emit('cleared');
    this.emit('change');
  }
}