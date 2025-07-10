/**
 * Extraction module exports
 * @module puppeteer/actions/execution/extraction
 * @nist ac-3 "Access enforcement"
 */

export { ScreenshotExtractor } from './screenshot-extractor.js';
export { PDFExtractor } from './pdf-extractor.js';
export { ContentExtractor, ContentType } from './content-extractor.js';
export { TextExtractor } from './text-extractor.js';
export { AttributeExtractor } from './attribute-extractor.js';
export { 
  ExtractionFactory, 
  ExtractionActionType,
  type ExtractionHandler,
} from './extraction-factory.js';