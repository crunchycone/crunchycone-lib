export interface TemplateData {
  [key: string]: any;
}

export interface EmailTemplateOptions {
  template: string;
  to: string | string[];
  language?: string;
  data?: TemplateData;
  from?: string;
}

export interface TemplateFiles {
  mjml: string;
  subject: string;
  textFallback?: string;
  dataPreview?: TemplateData;
}

export interface TemplateResolution {
  files: TemplateFiles;
  language: string;
  fallbackUsed: boolean;
  templatePath: string;
}

export interface RenderedTemplate {
  html: string;
  text: string;
  subject: string;
  metadata: {
    language: string;
    fallbackUsed: boolean;
    mjmlWarnings?: any[];
  };
}

export interface TemplateMetadata {
  name: string;
  languages: string[];
  dataSchema?: string;
  description?: string;
}

export interface TemplateProvider {
  resolveTemplate(templateName: string, language?: string): Promise<TemplateResolution>;
  getAvailableTemplates(): Promise<TemplateMetadata[]>;
  validateTemplate(templateName: string, language?: string): Promise<boolean>;
}

export interface EmailTemplateEngine {
  renderTemplate(options: EmailTemplateOptions): Promise<RenderedTemplate>;
  getAvailableTemplates(): Promise<TemplateMetadata[]>;
  validateTemplate(templateName: string, language?: string): Promise<boolean>;
  previewTemplate(templateName: string, data: TemplateData, language?: string): Promise<RenderedTemplate>;
}

export type TemplateProviderType = 'filesystem' | 'database';