# File Streaming Interface for CrunchyCone Storage Providers

## Overview

This document describes the comprehensive file streaming interface designed for the CrunchyCone storage library. The interface allows direct streaming of files from storage providers without loading entire files into memory, enabling efficient handling of large files and real-time data processing.

## 🎯 **Key Benefits**

### ✅ **Memory Efficiency**
- Stream large files without loading them entirely into memory
- Process files chunk by chunk for better resource utilization
- Handle files larger than available RAM

### ✅ **Performance**
- Faster time-to-first-byte compared to full downloads
- Concurrent streaming support with connection pooling
- Range request support for partial content streaming

### ✅ **Developer Experience**
- Unified interface across all storage providers
- Both Node.js and Web ReadableStream support
- Built-in error handling and cleanup mechanisms
- Rich metadata and progress tracking capabilities

### ✅ **Flexibility**
- Optional implementation per provider
- Range request support for resumable downloads
- Cancellation support via AbortSignal
- Provider-specific configuration options

## 🔧 **Interface Design**

### Core Types

```typescript
interface FileStreamOptions {
  start?: number;                   // Byte offset to start streaming from
  end?: number;                     // Byte offset to end streaming at
  responseType?: 'node' | 'web';    // Type of stream to return
  signal?: AbortSignal;             // For request cancellation
  timeout?: number;                 // Request timeout in milliseconds
  includeMetadata?: boolean;        // Whether to include file metadata
}

interface FileStreamResult {
  stream: NodeJS.ReadableStream | ReadableStream;  // The actual stream
  contentType: string;                             // MIME type
  contentLength?: number;                          // Total file size
  lastModified?: Date;                             // Last modification date
  etag?: string;                                   // Entity tag for caching
  acceptsRanges?: boolean;                         // Range request support
  isPartialContent: boolean;                       // Whether this is partial content
  range?: {                                        // Range information
    start: number;
    end: number;
    total: number;
  };
  streamType: 'node' | 'web';                      // Type of stream returned
  providerSpecific?: {                             // Provider-specific data
    signedUrl?: string;
    cacheControl?: string;
    [key: string]: any;
  };
  cleanup?: () => Promise<void>;                   // Cleanup function
}
```

### Provider Interface

```typescript
interface StorageProvider {
  // Optional streaming methods (not all providers implement)
  getFileStream?(key: string, options?: FileStreamOptions): Promise<FileStreamResult>;
  getFileStreamByExternalId?(externalId: string, options?: FileStreamOptions): Promise<FileStreamResult>;
}
```

## 🚀 **Implementation Status**

### ✅ **CrunchyCone Provider (Fully Implemented)**
- Uses signed URLs with fetch API for streaming
- Full range request support
- Both Node.js and Web ReadableStream support
- Automatic authentication handling
- Content verification and metadata extraction

### 📋 **Other Providers (Implementation Ready)**
- **LocalStorage**: File system streaming with `fs.createReadStream()`
- **S3/Compatible**: AWS SDK streaming with `GetObjectCommand`
- **GCP Storage**: Native streaming with `file.createReadStream()`
- **Azure Blob**: Blob download streams with range support

## 📖 **Usage Examples**

### Basic Streaming

```typescript
const provider = new CrunchyConeProvider(config);

// Check if streaming is supported
if (provider.getFileStream) {
  const streamResult = await provider.getFileStream('my-file.pdf');
  
  // Stream to local file
  const writeStream = createWriteStream('./output.pdf');
  await pipeline(streamResult.stream as NodeJS.ReadableStream, writeStream);
  
  // Always cleanup
  await streamResult.cleanup?.();
}
```

### Range Requests (Partial Content)

```typescript
// Download first 1MB of a large file
const streamResult = await provider.getFileStream('large-video.mp4', {
  start: 0,
  end: 1024 * 1024 - 1,
});

console.log(`Streaming ${streamResult.range?.end - streamResult.range?.start + 1} bytes`);
```

### HTTP Response Streaming

```typescript
app.get('/files/:id', async (req, res) => {
  const streamResult = await provider.getFileStreamByExternalId(req.params.id);
  
  // Set appropriate headers
  res.setHeader('Content-Type', streamResult.contentType);
  res.setHeader('Content-Length', streamResult.contentLength);
  
  // Stream directly to HTTP response
  (streamResult.stream as NodeJS.ReadableStream).pipe(res);
});
```

### Progress Tracking

```typescript
const streamResult = await provider.getFileStream('large-file.bin');
let downloadedBytes = 0;

const progressTracker = new Transform({
  transform(chunk, encoding, callback) {
    downloadedBytes += chunk.length;
    const percentage = Math.round((downloadedBytes / streamResult.contentLength!) * 100);
    console.log(`Progress: ${percentage}%`);
    callback(null, chunk);
  }
});

await pipeline(
  streamResult.stream as NodeJS.ReadableStream,
  progressTracker,
  createWriteStream('./output.file')
);
```

### Concurrent Streaming

```typescript
const fileIds = ['file1', 'file2', 'file3'];
const streams = await Promise.all(
  fileIds.map(id => provider.getFileStreamByExternalId!(id))
);

try {
  await Promise.all(streams.map((stream, index) => 
    pipeline(
      stream.stream as NodeJS.ReadableStream,
      createWriteStream(`./output-${index}.file`)
    )
  ));
} finally {
  // Cleanup all streams
  await Promise.all(streams.map(s => s.cleanup?.()).filter(Boolean));
}
```

## 🔒 **Security Considerations**

### Authentication
- CrunchyCone: Automatic signed URL generation with API key authentication
- S3: IAM-based access control with temporary credentials
- Azure: SAS tokens or managed identity authentication
- GCP: Service account or OAuth2 authentication

### Access Control
- Range requests respect file-level permissions
- Signed URLs inherit file visibility settings
- Streaming doesn't bypass existing access controls

## 📊 **Performance Characteristics**

### CrunchyCone Provider
- **Latency**: ~100-200ms for signed URL generation + network RTT
- **Throughput**: Limited by network bandwidth and storage backend
- **Memory Usage**: Constant ~64KB for stream buffers
- **Concurrent Streams**: Recommended max 5-10 per provider instance

### Optimization Strategies
1. **Connection Pooling**: Reuse HTTP connections for multiple streams
2. **Parallel Processing**: Stream multiple files concurrently
3. **Adaptive Chunking**: Adjust chunk sizes based on file size and network conditions
4. **Caching**: Cache signed URLs within their expiration window

## 🛠 **Error Handling**

### Common Error Scenarios
- **File Not Found**: Thrown before streaming starts
- **Network Timeouts**: Configurable via `timeout` option
- **Cancelled Requests**: Handled via `AbortSignal`
- **Partial Failures**: Range request errors
- **Provider Limitations**: Not all providers support all features

### Best Practices
```typescript
async function safeStreaming() {
  let streamResult: FileStreamResult | null = null;
  
  try {
    streamResult = await provider.getFileStream('file.dat', {
      timeout: 30000,
      signal: controller.signal,
    });
    
    await processStream(streamResult.stream);
    
  } catch (error) {
    console.error('Streaming failed:', error);
    throw error;
  } finally {
    // Always cleanup
    await streamResult?.cleanup?.();
  }
}
```

## 🔮 **Future Enhancements**

### Planned Features
1. **Adaptive Bitrate Streaming**: Automatic quality adjustment
2. **Delta Streaming**: Stream only changed portions of files
3. **Compression**: On-the-fly compression/decompression
4. **Multi-Provider Failover**: Automatic fallback between providers
5. **Stream Multiplexing**: Combine multiple streams into one

### Provider Extensions
1. **CDN Integration**: Direct streaming from CDN edges
2. **P2P Streaming**: Peer-to-peer file distribution
3. **Encrypted Streams**: End-to-end encryption for sensitive data
4. **Stream Analytics**: Real-time streaming metrics and monitoring

## 📚 **Related Documentation**

- [Storage Provider Configuration](./STORAGE_PROVIDERS.md)
- [File Visibility Management](./VISIBILITY_MANAGEMENT.md)
- [Error Handling Guide](./ERROR_HANDLING.md)
- [Performance Optimization](./PERFORMANCE.md)

## 🤝 **Contributing**

To implement streaming for additional providers:

1. Add the optional methods to your provider class
2. Follow the interface specifications exactly
3. Include comprehensive error handling
4. Add unit tests covering all scenarios
5. Update documentation with provider-specific details

The streaming interface is designed to be progressively enhanced - providers can implement it when ready without breaking existing functionality.