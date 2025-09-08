# CrunchyCone API Client & Authentication

This document covers the CrunchyCone API Client and unified authentication service that provides API-first authentication with CLI fallback.

## 🔑 Authentication Methods

The CrunchyCone library supports multiple authentication methods with automatic fallback:

1. **API Key (Environment Variable)** - `CRUNCHYCONE_API_KEY` 
2. **API Key (Keychain)** - Stored via `crunchycone auth login`
3. **CLI Fallback** - Executes `npx crunchycone-cli auth check -j`

## 📦 Installation & Setup

```bash
npm install crunchycone-lib
```

For CLI fallback support (optional):
```bash
npm install -g crunchycone-cli
```

## 🚀 Quick Start

### Basic Authentication Check

```typescript
import { checkCrunchyConeAuth } from 'crunchycone-lib';

const authResult = await checkCrunchyConeAuth();

if (authResult.success) {
  console.log(`✅ Authenticated as ${authResult.user?.email} via ${authResult.source}`);
  if (authResult.project) {
    console.log(`📁 Project: ${authResult.project.name}`);
  }
} else {
  console.error(`❌ Authentication failed: ${authResult.error}`);
}
```

### Custom Authentication Service

```typescript
import { createCrunchyConeAuthService } from 'crunchycone-lib';

const authService = createCrunchyConeAuthService({
  timeout: 5000,        // API timeout in ms
  preferApi: true,      // Prefer API over CLI
  cliTimeout: 15000,    // CLI timeout in ms
});

const result = await authService.checkAuthentication();
```

## 🔧 API Client Direct Usage

### Validate API Key

```typescript
import { validateApiKey } from 'crunchycone-lib';

try {
  const user = await validateApiKey('your-api-key');
  console.log(`Valid API key for: ${user.email}`);
} catch (error) {
  console.error('Invalid API key:', error.message);
}
```

### Get User Information

```typescript
import { getCurrentUser } from 'crunchycone-lib';

const user = await getCurrentUser('your-api-key');
console.log(`User: ${user.name} (${user.email})`);
```

### Get Project Information

```typescript
import { getProjectInfo } from 'crunchycone-lib';

const project = await getProjectInfo('your-api-key', 'project-123');
console.log(`Project: ${project.name}`);
```

### Using the API Client Class

```typescript
import { CrunchyConeApiClient } from 'crunchycone-lib';

const client = new CrunchyConeApiClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.crunchycone.com', // Optional
  timeout: 10000, // Optional, defaults to 10 seconds
});

// Validate API key
const user = await client.validateApiKey();

// Get project info
const project = await client.getProjectInfo('your-api-key', 'project-123');
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CRUNCHYCONE_API_KEY` | Your CrunchyCone API key | Optional* |
| `CRUNCHYCONE_API_URL` | Custom API endpoint | Optional |
| `CRUNCHYCONE_PROJECT_ID` | Default project ID | Optional |

*Required if keychain access is not available and CLI is not installed.

### Authentication Priority

1. **Environment Variable**: `CRUNCHYCONE_API_KEY` is checked first
2. **Keychain Access**: Falls back to keychain-stored API key
3. **CLI Command**: Falls back to `npx crunchycone-cli auth check -j`

## 🔍 Response Format

All authentication methods return a consistent `CrunchyConeAuthResult`:

```typescript
interface CrunchyConeAuthResult {
  success: boolean;
  source: 'api' | 'cli';
  user?: {
    email: string;
    name?: string;
    id?: string;
  };
  project?: {
    project_id: string;
    name?: string;
  };
  error?: string;
  message?: string;
}
```

## 🏷️ TypeScript Types

### API Client Types

```typescript
interface CrunchyConeApiConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

interface CrunchyConeUser {
  id: string;
  email: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
}

interface CrunchyConeProject {
  project_id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}
```

### Authentication Service Types

```typescript
interface CrunchyConeAuthServiceConfig {
  timeout?: number;       // API timeout in ms (default: 10000)
  preferApi?: boolean;    // Prefer API over CLI (default: true)
  cliTimeout?: number;    // CLI timeout in ms (default: 15000)
}
```

## 🚨 Error Handling

### Common Error Scenarios

#### Invalid API Key
```typescript
const authResult = await checkCrunchyConeAuth();
if (!authResult.success && authResult.error?.includes('Invalid API key')) {
  console.log('Please check your API key or run: crunchycone auth login');
}
```

#### Network Issues
```typescript
const authResult = await checkCrunchyConeAuth();
if (!authResult.success && authResult.error?.includes('Network')) {
  console.log('Network error, retrying with CLI fallback...');
}
```

#### CLI Not Available
```typescript
const authResult = await checkCrunchyConeAuth();
if (!authResult.success && authResult.error?.includes('crunchycone-cli not found')) {
  console.log('Install CLI: npm install -g crunchycone-cli');
}
```

## 🔧 Advanced Usage

### Custom API Endpoint

```typescript
import { validateApiKey } from 'crunchycone-lib';

// Use custom API endpoint (e.g., development environment)
const user = await validateApiKey(
  'your-api-key',
  'https://api.crunchycone.dev'
);
```

### Timeout Configuration

```typescript
import { createCrunchyConeAuthService } from 'crunchycone-lib';

const authService = createCrunchyConeAuthService({
  timeout: 5000,     // 5 second API timeout
  cliTimeout: 20000, // 20 second CLI timeout
});
```

### API-Only Authentication (No CLI Fallback)

```typescript
import { CrunchyConeApiClient } from 'crunchycone-lib';

const client = new CrunchyConeApiClient({
  apiKey: process.env.CRUNCHYCONE_API_KEY!,
});

try {
  const user = await client.validateApiKey();
  console.log('API authentication successful');
} catch (error) {
  console.error('API authentication failed:', error.message);
  // No CLI fallback in this approach
}
```

## 🏢 Production Deployment

### Container Environments

In containerized environments where CLI tools may not be ideal:

```typescript
// Set environment variable in your container
// CRUNCHYCONE_API_KEY=your-production-api-key

import { checkCrunchyConeAuth } from 'crunchycone-lib';

const authResult = await checkCrunchyConeAuth({
  preferApi: true,  // Prefer API over CLI in production
  timeout: 5000,    // Shorter timeout for faster failures
});
```

### CI/CD Pipelines

```typescript
// In CI/CD, use environment variables for authentication
import { validateApiKey } from 'crunchycone-lib';

if (!process.env.CRUNCHYCONE_API_KEY) {
  throw new Error('CRUNCHYCONE_API_KEY is required in CI/CD');
}

const user = await validateApiKey(process.env.CRUNCHYCONE_API_KEY);
console.log(`CI/CD authenticated as: ${user.email}`);
```

## 🧪 Testing

### Mocking Authentication in Tests

```typescript
import { checkCrunchyConeAuth } from 'crunchycone-lib';

jest.mock('crunchycone-lib', () => ({
  checkCrunchyConeAuth: jest.fn(),
}));

const mockCheckAuth = checkCrunchyConeAuth as jest.MockedFunction<typeof checkCrunchyConeAuth>;

beforeEach(() => {
  mockCheckAuth.mockResolvedValue({
    success: true,
    source: 'api',
    user: { email: 'test@example.com', name: 'Test User', id: 'user-123' },
    message: 'Mocked authentication',
  });
});
```

## 📝 Migration from CLI-Only Approach

If you were previously using CLI-only authentication:

### Before
```bash
npx crunchycone-cli auth check -j
```

### After
```typescript
import { checkCrunchyConeAuth } from 'crunchycone-lib';

const authResult = await checkCrunchyConeAuth();
// Automatically tries API first, falls back to CLI if needed
```

The new approach is:
- ✅ **Faster** - API calls are quicker than spawning CLI processes
- ✅ **More reliable** - Better error handling and timeout control
- ✅ **Production-friendly** - Works in containerized environments
- ✅ **Backwards compatible** - Still falls back to CLI when needed

## 🤝 Contributing

When contributing to the CrunchyCone API client or authentication service:

1. **Add tests** for any new functionality
2. **Update types** if adding new interfaces
3. **Consider backwards compatibility** with existing CLI users
4. **Document breaking changes** in commit messages

## 📚 Related Documentation

- [Email Providers](EMAIL_PROVIDERS.md) - CrunchyCone email provider usage
- [CrunchyCone Storage](CRUNCHYCONE_STORAGE.md) - CrunchyCone storage provider
- [Storage Services](STORAGE.md) - General storage provider documentation