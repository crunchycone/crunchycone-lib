import { 
  EmailService, 
  EmailParams, 
  EmailResponse, 
  EmailRecipient, 
  EmailAddress,
  EmailStatusResponse,
  ListEmailsResponse,
  ListEmailsOptions,
} from '../types';
import { getCrunchyConeAPIKeyWithFallback, getCrunchyConeAPIURL, getCrunchyConeProjectID } from '../../../auth';

export interface CrunchyConeEmailConfig {
  apiKey: string;
  baseUrl: string;
  projectId?: string;
  timeout?: number;
}

export interface CrunchyConeEmailPayload {
  from: {
    name: string;
    email: string;
  };
  to: {
    name?: string;
    email: string;
  } | Array<{
    name?: string;
    email: string;
  }>;
  subject: string;
  text: string;
  html?: string;
  special?: boolean;
}

export interface CrunchyConeEmailApiResponse {
  email_id: string;
  status: string;
  message: string;
  sendgrid_message_id: string;
  sent_at: string;
}

export interface CrunchyConeEmailStatusApiResponse {
  email_id: string;
  from: {
    name: string;
    email: string;
  };
  to: Array<{
    name: string;
    email: string;
  }>;
  subject: string;
  status: string;
  failure_reason?: string;
  sendgrid_message_id?: string;
  is_cli_api_key: boolean;
  is_special: boolean;
  created_at: string;
  sent_at?: string;
  delivered_at?: string;
}

export interface CrunchyConeListEmailsApiResponse {
  emails: CrunchyConeEmailStatusApiResponse[];
  total_count: number;
  has_more: boolean;
}

export class CrunchyConeEmailService implements EmailService {
  private config!: CrunchyConeEmailConfig;
  private configPromise: Promise<void>;

  constructor(config?: Partial<CrunchyConeEmailConfig>) {
    // Validate API key is available before proceeding
    if (!config?.apiKey && !process.env.CRUNCHYCONE_API_KEY) {
      throw new Error('CrunchyCone API key is required. Set CRUNCHYCONE_API_KEY environment variable or pass apiKey in config.');
    }
    
    // Initialize config asynchronously
    this.configPromise = this.initializeConfig(config);
  }

  private async initializeConfig(config?: Partial<CrunchyConeEmailConfig>): Promise<void> {
    let apiKey: string;
    
    if (config?.apiKey) {
      apiKey = config.apiKey;
    } else {
      // Use the auth utility to get API key from env or keychain
      apiKey = await getCrunchyConeAPIKeyWithFallback();
    }

    const baseUrl = config?.baseUrl || getCrunchyConeAPIURL() || 'https://api.crunchycone.com';
    const projectId = config?.projectId || getCrunchyConeProjectID();

    this.config = {
      apiKey,
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      projectId,
      timeout: config?.timeout || 30000, // 30 seconds default
    };

    // Debug logging for configuration
    console.log('🔧 CrunchyCone Email Config:');
    console.log(`   API URL: ${this.config.baseUrl}`);
    console.log(`   API Key: ${this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : '(not set)'}`);
    if (this.config.projectId) {
      console.log(`   Project ID: ${this.config.projectId}`);
    } else {
      console.log('   Project ID: (not set)');
    }
  }

  private async ensureConfigured(): Promise<void> {
    await this.configPromise;
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    await this.ensureConfigured();
    
    try {
      const payload = this.buildEmailPayload(params);
      const response = await this.makeApiCall('/api/v1/emails/send', 'POST', payload);

      if (response.ok) {
        const data = await response.json() as CrunchyConeEmailApiResponse;
        return {
          success: true,
          messageId: data.email_id,
          emailId: data.email_id,
          status: data.status,
          sendgridMessageId: data.sendgrid_message_id,
          sentAt: new Date(data.sent_at),
        };
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
        return {
          success: false,
          error: `CrunchyCone API error: ${response.status} - ${errorData.message || errorData.error || 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private buildEmailPayload(params: EmailParams): CrunchyConeEmailPayload {
    // Normalize from address
    let fromAddress: EmailAddress;
    
    if (params.from) {
      fromAddress = this.normalizeEmailAddress(params.from);
      // If no name is provided but we have a display name from environment, use it
      if (!fromAddress.name && process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY) {
        fromAddress.name = process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY;
      }
    } else {
      fromAddress = {
        email: process.env.CRUNCHYCONE_EMAIL_FROM_EMAIL || 'noreply@crunchycone.com',
        name: process.env.CRUNCHYCONE_EMAIL_FROM_NAME || 'CrunchyCone Platform',
      };
    }

    // Normalize to addresses
    const toAddresses = this.normalizeEmailAddresses(params.to);

    // Check if we should use the special flag from params or provider settings
    const isSpecial = params.sensitive === true || params.providerSettings?.special === true;

    // Build payload according to the API spec
    const payload: CrunchyConeEmailPayload = {
      from: {
        name: fromAddress.name || '',
        email: fromAddress.email,
      },
      to: toAddresses.length === 1 
        ? { name: toAddresses[0].name || '', email: toAddresses[0].email }
        : toAddresses.map(addr => ({ name: addr.name || '', email: addr.email })),
      subject: params.subject,
      text: params.textBody,
      special: isSpecial,
    };

    if (params.htmlBody) {
      payload.html = params.htmlBody;
    }

    return payload;
  }

  private normalizeEmailAddress(recipient: EmailRecipient): EmailAddress {
    if (typeof recipient === 'string') {
      return this.parseEmailString(recipient);
    }
    return recipient;
  }

  private parseEmailString(emailString: string): EmailAddress {
    // Handle "Name <email@domain.com>" format
    const nameEmailMatch = emailString.match(/^(.+?)\s*<(.+?)>$/);
    if (nameEmailMatch) {
      return {
        name: nameEmailMatch[1].trim(),
        email: nameEmailMatch[2].trim(),
      };
    }

    // Handle plain email format
    return { email: emailString.trim() };
  }

  private normalizeEmailAddresses(recipients: EmailRecipient | EmailRecipient[]): EmailAddress[] {
    const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
    return recipientArray.map(r => this.normalizeEmailAddress(r));
  }

  private async makeApiCall(endpoint: string, method: string, body?: any): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Debug logging
    console.log(`🌐 CrunchyCone API Call: ${method} ${url}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
      'User-Agent': 'crunchycone-lib/1.0',
    };

    // Add project ID header if available
    if (this.config.projectId) {
      headers['X-Project-ID'] = this.config.projectId;
    }

    if (body) {
      console.log('📤 Request Body:', JSON.stringify(body, null, 2));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      // Debug logging for response
      console.log(`📥 Response Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error Response Body:', errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }

  async getEmailStatus(emailId: string): Promise<EmailStatusResponse> {
    await this.ensureConfigured();
    
    try {
      const response = await this.makeApiCall(`/api/v1/emails/${emailId}`, 'GET');
      
      if (response.ok) {
        const data = await response.json() as CrunchyConeEmailStatusApiResponse;
        return this.mapEmailStatusResponse(data);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
        throw new Error(`Failed to get email status: ${response.status} - ${errorData.message || errorData.error}`);
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }

  async listEmails(options: ListEmailsOptions = {}): Promise<ListEmailsResponse> {
    await this.ensureConfigured();
    
    try {
      const queryParams = new URLSearchParams();
      
      if (options.status) queryParams.set('status', options.status);
      if (options.limit) queryParams.set('limit', options.limit.toString());
      if (options.offset) queryParams.set('offset', options.offset.toString());
      
      const endpoint = `/api/v1/emails${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await this.makeApiCall(endpoint, 'GET');
      
      if (response.ok) {
        const data = await response.json() as CrunchyConeListEmailsApiResponse;
        return {
          emails: data.emails.map(email => this.mapEmailStatusResponse(email)),
          totalCount: data.total_count,
          hasMore: data.has_more,
        };
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
        throw new Error(`Failed to list emails: ${response.status} - ${errorData.message || errorData.error}`);
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }

  private mapEmailStatusResponse(data: CrunchyConeEmailStatusApiResponse): EmailStatusResponse {
    return {
      emailId: data.email_id,
      from: data.from,
      to: data.to,
      subject: data.subject,
      status: data.status as any,
      failureReason: data.failure_reason,
      sendgridMessageId: data.sendgrid_message_id,
      isCliApiKey: data.is_cli_api_key,
      isSensitive: data.is_special,
      createdAt: new Date(data.created_at),
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      deliveredAt: data.delivered_at ? new Date(data.delivered_at) : undefined,
    };
  }

}