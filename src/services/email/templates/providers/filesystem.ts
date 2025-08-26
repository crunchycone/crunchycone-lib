import { readFileSync, existsSync } from 'fs';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { TemplateProvider, TemplateResolution, TemplateFiles, TemplateMetadata } from '../types';

export class FilesystemTemplateProvider implements TemplateProvider {
  private templatesPath: string;
  private defaultLanguage = 'en';

  constructor(templatesPath?: string) {
    this.templatesPath = templatesPath || process.env.CRUNCHYCONE_EMAIL_TEMPLATES_PATH || join(process.cwd(), 'templates/email');
  }

  async resolveTemplate(templateName: string, language?: string): Promise<TemplateResolution> {
    const targetLanguage = language || this.defaultLanguage;
    
    // Try requested language first
    let templatePath = join(this.templatesPath, targetLanguage, templateName);
    let actualLanguage = targetLanguage;
    let fallbackUsed = false;

    if (!existsSync(templatePath)) {
      // Fallback to default language
      templatePath = join(this.templatesPath, this.defaultLanguage, templateName);
      actualLanguage = this.defaultLanguage;
      fallbackUsed = language !== this.defaultLanguage;
    }

    if (!existsSync(templatePath)) {
      throw new Error(`Template '${templateName}' not found in any language`);
    }

    const files = this.loadTemplateFiles(templatePath);

    return {
      files,
      language: actualLanguage,
      fallbackUsed,
      templatePath,
    };
  }

  private loadTemplateFiles(templatePath: string): TemplateFiles {
    const mjmlPath = join(templatePath, 'template-html.mjml');
    const subjectPath = join(templatePath, 'subject.liquid');
    const textPath = join(templatePath, 'template-text.liquid');
    const dataPreviewPath = join(templatePath, 'data-preview.json');

    if (!existsSync(mjmlPath)) {
      throw new Error(`MJML template not found: ${mjmlPath}`);
    }

    if (!existsSync(subjectPath)) {
      throw new Error(`Subject template not found: ${subjectPath}`);
    }

    const files: TemplateFiles = {
      mjml: readFileSync(mjmlPath, 'utf-8'),
      subject: readFileSync(subjectPath, 'utf-8'),
    };

    if (existsSync(textPath)) {
      files.textFallback = readFileSync(textPath, 'utf-8');
    }

    if (existsSync(dataPreviewPath)) {
      try {
        const dataContent = readFileSync(dataPreviewPath, 'utf-8');
        files.dataPreview = JSON.parse(dataContent);
      } catch (_error) {
        console.warn(`Warning: Invalid JSON in ${dataPreviewPath}`);
      }
    }

    return files;
  }

  async getAvailableTemplates(): Promise<TemplateMetadata[]> {
    const templates: TemplateMetadata[] = [];
    const languages = await this.getAvailableLanguages();

    for (const language of languages) {
      const languagePath = join(this.templatesPath, language);
      const templateNames = await this.getTemplateNames(languagePath);

      for (const templateName of templateNames) {
        let existingTemplate = templates.find(t => t.name === templateName);
        
        if (!existingTemplate) {
          const metadata = await this.getTemplateMetadata(templateName, language);
          existingTemplate = {
            name: templateName,
            languages: [],
            ...metadata,
          };
          templates.push(existingTemplate);
        }
        
        existingTemplate.languages.push(language);
      }
    }

    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  async validateTemplate(templateName: string, language?: string): Promise<boolean> {
    try {
      const resolution = await this.resolveTemplate(templateName, language);
      // If a specific language was requested but we had to fallback, consider it invalid
      if (language && resolution.fallbackUsed) {
        return false;
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  private async getTemplateMetadata(templateName: string, language: string): Promise<Partial<TemplateMetadata>> {
    const templatePath = join(this.templatesPath, language, templateName);
    const metadata: Partial<TemplateMetadata> = {};

    const schemaPath = join(templatePath, 'data-schema.ts');
    if (existsSync(schemaPath)) {
      metadata.dataSchema = schemaPath;
    }

    const mjmlPath = join(templatePath, 'template-html.mjml');
    if (existsSync(mjmlPath)) {
      try {
        const mjmlContent = await readFile(mjmlPath, 'utf-8');
        const descriptionMatch = mjmlContent.match(/<!--\s*Description:\s*(.+?)\s*-->/i);
        if (descriptionMatch) {
          metadata.description = descriptionMatch[1].trim();
        }
      } catch {
        // Ignore errors
      }
    }

    return metadata;
  }

  private async getAvailableLanguages(): Promise<string[]> {
    try {
      const items = await readdir(this.templatesPath);
      const languages: string[] = [];

      for (const item of items) {
        const itemPath = join(this.templatesPath, item);
        const itemStat = await stat(itemPath);
        
        if (itemStat.isDirectory() && item.match(/^[a-z]{2}$/)) {
          languages.push(item);
        }
      }

      return languages.sort();
    } catch {
      return [];
    }
  }

  async readIncludeFile(includeFileName: string, language?: string): Promise<string> {
    const targetLanguage = language || this.defaultLanguage;
    
    // Try requested language first
    let includePath = join(this.templatesPath, targetLanguage, 'includes', includeFileName);
    
    // Add .liquid extension if not present
    if (!includeFileName.endsWith('.liquid')) {
      includePath += '.liquid';
    }
    
    if (!existsSync(includePath)) {
      // Fallback to default language
      includePath = join(this.templatesPath, this.defaultLanguage, 'includes', includeFileName);
      if (!includeFileName.endsWith('.liquid')) {
        includePath += '.liquid';
      }
    }

    if (!existsSync(includePath)) {
      throw new Error(`Include file '${includeFileName}' not found in language '${targetLanguage}' or default language`);
    }

    return readFileSync(includePath, 'utf-8');
  }

  async includeExists(includeFileName: string, language?: string): Promise<boolean> {
    const targetLanguage = language || this.defaultLanguage;
    
    // Try requested language first
    let includePath = join(this.templatesPath, targetLanguage, 'includes', includeFileName);
    
    // Add .liquid extension if not present
    if (!includeFileName.endsWith('.liquid')) {
      includePath += '.liquid';
    }
    
    if (existsSync(includePath)) {
      return true;
    }
    
    // Fallback to default language
    includePath = join(this.templatesPath, this.defaultLanguage, 'includes', includeFileName);
    if (!includeFileName.endsWith('.liquid')) {
      includePath += '.liquid';
    }
    
    return existsSync(includePath);
  }

  private async getTemplateNames(languagePath: string): Promise<string[]> {
    try {
      const items = await readdir(languagePath);
      const templates: string[] = [];

      for (const item of items) {
        const itemPath = join(languagePath, item);
        const itemStat = await stat(itemPath);
        
        if (itemStat.isDirectory()) {
          const mjmlPath = join(itemPath, 'template-html.mjml');
          const subjectPath = join(itemPath, 'subject.liquid');
          
          if (existsSync(mjmlPath) && existsSync(subjectPath)) {
            templates.push(item);
          }
        }
      }

      return templates.sort();
    } catch {
      return [];
    }
  }
}