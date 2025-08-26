import { Liquid } from 'liquidjs';
import { convert } from 'html-to-text';
import { 
  EmailTemplateOptions, 
  RenderedTemplate,
  TemplateData,
  TemplateProvider,
  EmailTemplateEngine,
  TemplateMetadata,
} from '../types';

/**
 * Dynamically imports MJML only when needed, using eval to avoid bundler resolution
 * @returns Promise<any> The mjml2html function
 */
async function loadMJML(): Promise<any> {
  try {
    // In test environments, use require to avoid dynamic import issues with Jest
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
    
    if (isTestEnv) {
      // Use require in test environments
      const mjml = require('mjml');
      return mjml.default || mjml;
    } else {
      // Use eval to prevent bundlers from trying to resolve mjml at build time
      const mjml = await eval('import("mjml")');
      return mjml.default || mjml;
    }
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot resolve module')) {
      throw new Error(
        'MJML is not available. Email template rendering with MJML requires the mjml package to be installed.\n\n' +
        'To install MJML, run:\n' +
        '  npm install mjml\n\n' +
        'Or if using yarn:\n' +
        '  yarn add mjml\n\n' +
        'MJML is used for rendering responsive email templates and is required for the MJMLLiquidEngine.',
      );
    }
    throw error;
  }
}

export class MJMLLiquidEngine implements EmailTemplateEngine {
  private liquid: Liquid;
  private templateProvider: TemplateProvider;
  private currentLanguage?: string;

  constructor(templateProvider: TemplateProvider) {
    this.templateProvider = templateProvider;
    
    this.liquid = new Liquid({
      cache: process.env.NODE_ENV === 'production',
      strictFilters: true,
      strictVariables: false, // More forgiving for email templates
      trimTagLeft: false,
      trimTagRight: false,
      trimOutputLeft: false,
      trimOutputRight: false,
      fs: this.createCustomFileSystem(),
    });

    this.registerEmailFilters();
  }

  private createCustomFileSystem() {
    return {
      readFile: async (filepath: string): Promise<string> => {
        return await this.templateProvider.readIncludeFile(filepath, this.currentLanguage);
      },
      readFileSync: (filepath: string): string => {
        throw new Error('Synchronous file reading not supported. Use async rendering.');
      },
      exists: async (filepath: string): Promise<boolean> => {
        return await this.templateProvider.includeExists(filepath, this.currentLanguage)
          .catch(() => false);
      },
      existsSync: (filepath: string): boolean => {
        // Return true optimistically - async version handles the actual check
        return true;
      },
      resolve: (dir: string, file: string, ext: string): string => {
        // Just return the filename as-is since we're using template IDs
        // LiquidJS expects 3 parameters: dir, file, ext
        return file;
      },
      contains: (root: string, file: string): boolean => {
        // Always return true since we handle security through template provider
        return true;
      },
      sep: '/',
      dirname: (filepath: string): string => {
        return '';
      }
    };
  }

  private registerEmailFilters() {
    // Date formatting filter
    this.liquid.registerFilter('date_format', (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
      });
    });

    // URL encoding filter
    this.liquid.registerFilter('url_encode', (str: string) => {
      return encodeURIComponent(str);
    });

    // Truncate filter
    this.liquid.registerFilter('truncate', (str: string, length: number = 50) => {
      if (!str || str.length <= length) return str;
      return str.substring(0, length) + '...';
    });

    // Money formatting filter
    this.liquid.registerFilter('money', (amount: number, currency: string = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    });

    // Default filter
    this.liquid.registerFilter('default', (value: any, defaultValue: any) => {
      return value || defaultValue;
    });
  }

  async renderTemplate(options: EmailTemplateOptions): Promise<RenderedTemplate> {
    // Ensure MJML only runs in server environments
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      throw new Error('MJML template rendering is only available in server-side environments (Node.js)');
    }

    const { template, data = {}, language } = options;
    
    const resolution = await this.templateProvider.resolveTemplate(template, language);
    
    // Set current language for include resolution
    this.currentLanguage = resolution.language;
    
    // Render MJML template with Liquid preprocessing
    const renderedMjml = await this.liquid.parseAndRender(resolution.files.mjml, data);
    
    // Convert MJML to HTML using dynamic import
    const mjml2html = await loadMJML();
    const mjmlResult = mjml2html(renderedMjml, {
      validationLevel: 'strict',
      keepComments: false,
    });

    if (mjmlResult.errors.length > 0) {
      throw new Error(`MJML compilation errors: ${mjmlResult.errors.map((e: any) => e.message).join(', ')}`);
    }

    const html = mjmlResult.html;

    // Generate text version
    let text: string;
    if (resolution.files.textFallback) {
      text = await this.liquid.parseAndRender(resolution.files.textFallback, data);
    } else {
      text = this.htmlToText(html);
    }

    // Render subject
    const subject = await this.liquid.parseAndRender(resolution.files.subject, data);

    return {
      html,
      text: text.trim(),
      subject: subject.trim(),
      metadata: {
        language: resolution.language,
        fallbackUsed: resolution.fallbackUsed,
        mjmlWarnings: [],
      },
    };
  }

  private htmlToText(html: string): string {
    return convert(html, {
      wordwrap: 80,
      selectors: [
        { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
        { selector: 'img', format: 'skip' },
      ],
    });
  }

  async getAvailableTemplates(): Promise<TemplateMetadata[]> {
    return this.templateProvider.getAvailableTemplates();
  }

  async validateTemplate(templateName: string, language?: string): Promise<boolean> {
    // Ensure MJML only runs in server environments
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      throw new Error('MJML template validation is only available in server-side environments (Node.js)');
    }

    try {
      await this.renderTemplate({
        template: templateName,
        to: 'test@example.com',
        language,
        data: {},
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  async previewTemplate(templateName: string, data: TemplateData, language?: string): Promise<RenderedTemplate> {
    // Ensure MJML only runs in server environments  
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      throw new Error('MJML template preview is only available in server-side environments (Node.js)');
    }

    return this.renderTemplate({
      template: templateName,
      to: 'preview@example.com',
      data,
      language,
    });
  }
}