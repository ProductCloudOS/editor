import { PageData, DocumentSettings, ElementData, Point, Size } from '../types';
import { EventEmitter } from '../events/EventEmitter';
import { Section } from './Section';
import { FlowingTextContent } from '../text';

export class Page extends EventEmitter {
  private _id: string;
  private _header: Section;
  private _content: Section;
  private _footer: Section;
  private _flowingContent: FlowingTextContent;
  private _settings: DocumentSettings;

  constructor(data: PageData, settings: DocumentSettings) {
    super();
    this._id = data.id;
    this._settings = settings;

    this._header = new Section('header', data.header);
    this._content = new Section('content', data.content);
    this._footer = new Section('footer', data.footer);
    this._flowingContent = new FlowingTextContent();

    this.setupSectionListeners();
    this.setupFlowingContentListeners();
  }

  private setupSectionListeners(): void {
    [this._header, this._content, this._footer].forEach(section => {
      section.on('change', () => this.handleSectionChange());
    });
  }

  private setupFlowingContentListeners(): void {
    this._flowingContent.on('content-changed', () => {
      this.emit('flowing-content-changed');
      this.emit('change');
    });

    this._flowingContent.on('cursor-moved', (data) => {
      this.emit('cursor-moved', data);
    });

    this._flowingContent.on('formatting-changed', (data) => {
      this.emit('formatting-changed', data);
      this.emit('change');
    });

    this._flowingContent.on('inline-element-added', (data) => {
      this.emit('inline-element-added', data);
      this.emit('change');
    });
  }

  get id(): string {
    return this._id;
  }

  get header(): Section {
    return this._header;
  }

  get content(): Section {
    return this._content;
  }

  get footer(): Section {
    return this._footer;
  }

  get flowingContent(): FlowingTextContent {
    return this._flowingContent;
  }

  get settings(): DocumentSettings {
    return { ...this._settings };
  }

  getPageDimensions(): Size {
    const pageSizes = {
      A4: { width: 210, height: 297 },
      Letter: { width: 215.9, height: 279.4 },
      Legal: { width: 215.9, height: 355.6 },
      A3: { width: 297, height: 420 }
    };

    let dimensions: Size;
    if (this._settings.pageSize === 'Custom' && this._settings.customPageSize) {
      dimensions = { width: this._settings.customPageSize.width, height: this._settings.customPageSize.height };
    } else if (this._settings.pageSize !== 'Custom') {
      dimensions = pageSizes[this._settings.pageSize] || pageSizes.A4;
    } else {
      dimensions = pageSizes.A4;
    }

    if (this._settings.pageOrientation === 'landscape') {
      dimensions = { width: dimensions.height, height: dimensions.width };
    }

    return this.convertToPixels(dimensions);
  }

  private convertToPixels(size: Size): Size {
    const dpi = 96;
    const conversions: { [key: string]: number } = {
      px: 1,
      mm: dpi / 25.4,
      in: dpi,
      pt: dpi / 72
    };

    const factor = conversions[this._settings.units] || 1;
    return {
      width: size.width * factor,
      height: size.height * factor
    };
  }

  getContentBounds(): { position: Point; size: Size } {
    const pageDimensions = this.getPageDimensions();
    const margins = this._settings.margins;
    const marginFactor = this.convertToPixels({ width: 1, height: 1 }).width;

    // Header height should equal top margin, footer height should equal bottom margin
    // So content starts after top margin and ends before bottom margin
    const topMargin = margins.top * marginFactor;
    const bottomMargin = margins.bottom * marginFactor;
    const leftMargin = margins.left * marginFactor;
    const rightMargin = margins.right * marginFactor;

    return {
      position: {
        x: leftMargin,
        y: topMargin
      },
      size: {
        width: pageDimensions.width - leftMargin - rightMargin,
        height: pageDimensions.height - topMargin - bottomMargin
      }
    };
  }

  /**
   * Get the bounds for the header area.
   * Header uses left/right margins and top margin for height.
   */
  getHeaderBounds(): { position: Point; size: Size } {
    const pageDimensions = this.getPageDimensions();
    const margins = this._settings.margins;
    const marginFactor = this.convertToPixels({ width: 1, height: 1 }).width;
    const topMargin = margins.top * marginFactor;
    const leftMargin = margins.left * marginFactor;
    const rightMargin = margins.right * marginFactor;

    return {
      position: { x: leftMargin, y: 0 },
      size: {
        width: pageDimensions.width - leftMargin - rightMargin,
        height: topMargin
      }
    };
  }

  /**
   * Get the bounds for the footer area.
   * Footer uses left/right margins and bottom margin for height.
   */
  getFooterBounds(): { position: Point; size: Size } {
    const pageDimensions = this.getPageDimensions();
    const margins = this._settings.margins;
    const marginFactor = this.convertToPixels({ width: 1, height: 1 }).width;
    const bottomMargin = margins.bottom * marginFactor;
    const leftMargin = margins.left * marginFactor;
    const rightMargin = margins.right * marginFactor;

    return {
      position: {
        x: leftMargin,
        y: pageDimensions.height - bottomMargin
      },
      size: {
        width: pageDimensions.width - leftMargin - rightMargin,
        height: bottomMargin
      }
    };
  }

  updateSettings(settings: DocumentSettings): void {
    this._settings = settings;
    this.emit('settings-changed', { settings });
    this.emit('change');
  }

  private handleSectionChange(): void {
    this.emit('change');
  }

  getAllElements(): ElementData[] {
    return [
      ...this._header.getElements(),
      ...this._content.getElements(),
      ...this._footer.getElements()
    ];
  }

  getElementById(elementId: string): ElementData | undefined {
    return this.getAllElements().find(el => el.id === elementId);
  }

  toData(): PageData {
    return {
      id: this._id,
      header: this._header.toData(),
      content: this._content.toData(),
      footer: this._footer.toData()
    };
  }
}