# CLAUDE.md - CrunchyCone Library

## 📋 Project Overview

**Project Name:** CrunchyCone Library  
**Type:** TypeScript NPM Library  
**Purpose:** Unified abstractions for email services, storage providers, authentication, and environment/secrets management  
**Target Users:** CrunchyCone Starter Projects and TypeScript/JavaScript applications  

## 🏗️ Architecture

### Core Services
- **Email Services**: Unified API across 7+ providers (SendGrid, Resend, Amazon SES, SMTP, etc.)
- **Storage Services**: Multi-provider support (AWS S3, Google Cloud, Azure, etc.)
- **Authentication & API**: CrunchyCone API client with unified auth service
- **Environment & Secrets**: Unified management across local development and CrunchyCone platform

### Design Principles
- **Provider Abstraction**: Switch providers without code changes
- **Zero Optional Dependencies**: Core functionality works without installing cloud SDKs
- **Modular Imports**: Import only what you need
- **Environment Adaptive**: Automatically detects local vs platform environments
- **Production Ready**: Built for containerized and serverless environments

## 🔧 Development Workflow

### Build Commands
```bash
npm run build          # Build TypeScript
npm run clean          # Clean build artifacts
npm test               # Run tests
npm run lint           # ESLint
npm run lint:fix       # Auto-fix lint issues
```

### Testing Strategy
- **Unit Tests**: Individual service/provider testing
- **Integration Tests**: Cross-service functionality
- **Provider Availability**: Dynamic dependency checking
- **Environment Detection**: CRUNCHYCONE_PLATFORM behavior
- **Error Handling**: Network failures, invalid configs

### Key Test Areas
- Email provider abstraction and templating (MJML + LiquidJS)
- Storage provider operations and streaming
- Authentication flows (API + CLI fallback)
- Environment service provider switching
- Error propagation and handling

## 📦 Package Structure

```
src/
├── services/
│   ├── email/           # Email service abstractions
│   ├── storage/         # Storage provider abstractions
│   ├── environment/     # Environment & secrets management
│   ├── crunchycone-api.ts      # CrunchyCone API client
│   └── crunchycone-auth.ts     # Unified authentication
├── auth/                # Authentication utilities
├── api-external/        # Next.js API helpers
└── cli/                 # Development utilities

tests/
├── services/            # Service tests
└── shared/              # Test utilities
```

## 🌍 Environment Management

### Environment Detection
- **Local Development**: `CRUNCHYCONE_PLATFORM` not set or != "1"
  - Uses `.env` files for environment variables
  - Secrets operations are no-ops with warnings
- **Platform Environment**: `CRUNCHYCONE_PLATFORM=1`
  - Uses CrunchyCone API for env vars and secrets
  - Requires `CRUNCHYCONE_PROJECT_ID` and `CRUNCHYCONE_API_KEY`

### Provider System
- **LocalEnvironmentProvider**: `.env` file management with proper parsing/serialization
- **RemoteEnvironmentProvider**: CrunchyCone API integration
- **Unified Interface**: Same API works across environments

## 🔐 Authentication Flow

1. **Environment Variable**: `CRUNCHYCONE_API_KEY` (checked first)
2. **Keychain Fallback**: Via `getCrunchyConeAPIKeyWithFallback()`
3. **CLI Fallback**: `npx crunchycone-cli auth check -j`

## 📚 Documentation

### Main Documentation
- `README.md` - Complete usage guide and examples
- `docs/ENVIRONMENT_SECRETS.md` - Environment & secrets management
- `docs/CRUNCHYCONE_API_AUTH.md` - API client and authentication
- Provider-specific guides in `docs/` directory

### Code Documentation
- TypeScript interfaces for full IntelliSense
- JSDoc comments on public APIs
- Usage examples in service files
- Test files serve as implementation examples

## 🚀 Release Process

### Version Management
- Semantic versioning (major.minor.patch)
- Update version in `package.json`
- Tag releases with git tags

### Build Verification
```bash
npm run build          # Ensure clean build
npm test               # All tests must pass
npm run lint           # Zero lint errors
```

### Pre-Commit Requirements
**MANDATORY**: Before committing any changes, the following must pass:
```bash
npm run lint           # Must pass with zero errors
npm test               # All tests must pass
npm run build          # Must build successfully
```
**No exceptions** - commits should not be made if any of these checks fail.

### Publication
- Built artifacts in `dist/` directory
- NPM publication via `npm publish`
- GitHub releases with changelog

## 🧪 Testing Approach

### Provider Availability Testing
Dynamic checking for optional dependencies:
```typescript
const available = await isEmailProviderAvailable('sendgrid');
const providers = await getAvailableEmailProviders();
```

### Environment Service Testing
- Mock CrunchyCone API responses
- File system operations with temporary directories
- Environment variable manipulation in tests
- Provider switching verification

### Mock Strategy
- External API calls are mocked
- File system operations use temp directories
- Environment variables are isolated per test
- Network failures are simulated

## 🔧 Common Development Tasks

### Adding New Email Provider
1. Implement `EmailService` interface
2. Add to `src/services/email/providers/`
3. Update factory function
4. Add availability checking
5. Create comprehensive tests
6. Update documentation

### Adding New Storage Provider
1. Implement `StorageProvider` interface
2. Add to `src/services/storage/providers/`
3. Update availability checking
4. Add streaming support if applicable
5. Test with various file types and sizes

### Environment Service Changes
1. Update provider interfaces if needed
2. Maintain backward compatibility
3. Test both local and remote providers
4. Update environment detection logic
5. Verify API integration

## 🛠️ Troubleshooting

### Common Issues
- **Optional Dependencies**: Use availability checking before importing providers
- **Environment Detection**: Verify `CRUNCHYCONE_PLATFORM` value
- **API Authentication**: Check API key scopes and project access
- **File Permissions**: Ensure write access for `.env` files

### Debug Information
- Provider availability status
- Environment detection results  
- API client configuration
- File system permissions

## 📋 Maintenance Notes

### Dependencies
- **Core Dependencies**: Keep minimal and well-maintained
- **Optional Dependencies**: Mark as peer dependencies
- **Security**: Regular dependency audits
- **Updates**: Test thoroughly with dependency updates

### Code Quality
- **TypeScript**: Strict mode enabled
- **ESLint**: Comprehensive rules
- **Testing**: High coverage requirements
- **Documentation**: Keep in sync with code

---

This document serves as a comprehensive guide for understanding and maintaining the CrunchyCone Library codebase.