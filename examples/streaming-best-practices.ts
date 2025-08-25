// Best Practices for File Streaming with CrunchyCone Storage Providers

import { CrunchyConeProvider } from '../src/services/storage/providers/crunchycone';
import { FileStreamOptions, FileStreamResult } from '../src/services/storage/types';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import { Transform, PassThrough } from 'stream';

// ============================================================================
// UTILITY: Check if provider supports streaming
// ============================================================================

function supportsStreaming(provider: any): boolean {
  return typeof provider.getFileStream === 'function' && 
         typeof provider.getFileStreamByExternalId === 'function';
}

// ============================================================================
// BEST PRACTICE 1: Always handle errors and cleanup
// ============================================================================

async function safeFileStreaming(provider: CrunchyConeProvider, externalId: string) {
  let streamResult: FileStreamResult | null = null;
  
  try {
    // Check if provider supports streaming
    if (!supportsStreaming(provider)) {
      throw new Error('Provider does not support streaming');
    }

    streamResult = await provider.getFileStreamByExternalId!(externalId);
    
    console.log(`📊 Streaming file: ${streamResult.contentType}, ${streamResult.contentLength} bytes`);
    
    const writeStream = createWriteStream(`./downloads/${externalId}`);
    const nodeStream = streamResult.stream as NodeJS.ReadableStream;
    
    // Use pipeline for automatic error handling and cleanup
    await pipeline(nodeStream, writeStream);
    
    console.log('✅ File streamed successfully');
    
  } catch (error) {
    console.error('❌ Streaming failed:', error);
    throw error;
  } finally {
    // Always cleanup, even if an error occurred
    if (streamResult?.cleanup) {
      try {
        await streamResult.cleanup();
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup failed:', cleanupError);
      }
    }
  }
}

// ============================================================================
// BEST PRACTICE 2: Progress tracking with transform streams
// ============================================================================

class ProgressTracker extends Transform {
  private totalBytes: number;
  private downloadedBytes: number = 0;
  private onProgress: (progress: { bytes: number; total: number; percentage: number }) => void;

  constructor(totalBytes: number, onProgress: (progress: { bytes: number; total: number; percentage: number }) => void) {
    super();
    this.totalBytes = totalBytes;
    this.onProgress = onProgress;
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: Function) {
    this.downloadedBytes += chunk.length;
    const percentage = this.totalBytes > 0 ? Math.round((this.downloadedBytes / this.totalBytes) * 100) : 0;
    
    this.onProgress({
      bytes: this.downloadedBytes,
      total: this.totalBytes,
      percentage
    });
    
    callback(null, chunk);
  }
}

async function streamWithProgress(provider: CrunchyConeProvider, externalId: string) {
  const streamResult = await provider.getFileStreamByExternalId!(externalId);
  
  try {
    const progressTracker = new ProgressTracker(
      streamResult.contentLength || 0,
      (progress) => {
        console.log(`📊 Progress: ${progress.percentage}% (${progress.bytes}/${progress.total} bytes)`);
      }
    );
    
    const writeStream = createWriteStream(`./downloads/${externalId}`);
    const nodeStream = streamResult.stream as NodeJS.ReadableStream;
    
    await pipeline(nodeStream, progressTracker, writeStream);
    
  } finally {
    await streamResult.cleanup?.();
  }
}

// ============================================================================
// BEST PRACTICE 3: Resumable downloads with range requests
// ============================================================================

async function resumableDownload(provider: CrunchyConeProvider, externalId: string, localPath: string) {
  try {
    // Check if partial file exists
    const fs = await import('fs');
    let startByte = 0;
    
    try {
      const stats = await fs.promises.stat(localPath);
      startByte = stats.size;
      console.log(`🔄 Resuming download from byte ${startByte}`);
    } catch {
      console.log('📥 Starting new download');
    }

    // Get file info to check total size
    const fileInfo = await provider.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error('File not found');
    }

    if (startByte >= fileInfo.size) {
      console.log('✅ File already fully downloaded');
      return;
    }

    // Stream remaining part
    const streamResult = await provider.getFileStreamByExternalId!(externalId, {
      start: startByte,
    });

    try {
      const writeStream = createWriteStream(localPath, { flags: 'a' }); // Append mode
      const nodeStream = streamResult.stream as NodeJS.ReadableStream;
      
      await pipeline(nodeStream, writeStream);
      console.log('✅ Resumable download completed');
      
    } finally {
      await streamResult.cleanup?.();
    }
    
  } catch (error) {
    console.error('❌ Resumable download failed:', error);
    throw error;
  }
}

// ============================================================================
// BEST PRACTICE 4: Memory-efficient processing of large files
// ============================================================================

class JSONLineProcessor extends Transform {
  private buffer: string = '';
  private onLine: (line: object) => void;

  constructor(onLine: (line: object) => void) {
    super({ objectMode: true });
    this.onLine = onLine;
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: Function) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    
    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';
    
    // Process complete lines
    for (const line of lines) {
      if (line.trim()) {
        try {
          const jsonObject = JSON.parse(line);
          this.onLine(jsonObject);
        } catch (error) {
          console.warn('⚠️ Invalid JSON line:', line);
        }
      }
    }
    
    callback();
  }

  _flush(callback: Function) {
    // Process remaining buffer
    if (this.buffer.trim()) {
      try {
        const jsonObject = JSON.parse(this.buffer);
        this.onLine(jsonObject);
      } catch (error) {
        console.warn('⚠️ Invalid JSON in final buffer:', this.buffer);
      }
    }
    callback();
  }
}

async function processLargeJSONLFile(provider: CrunchyConeProvider, externalId: string) {
  const streamResult = await provider.getFileStreamByExternalId!(externalId);
  
  try {
    let lineCount = 0;
    const processor = new JSONLineProcessor((line) => {
      lineCount++;
      console.log(`📝 Processed line ${lineCount}:`, line);
      // Process each JSON line without loading entire file into memory
    });

    const nodeStream = streamResult.stream as NodeJS.ReadableStream;
    const passThrough = new PassThrough(); // End the pipeline
    
    await pipeline(nodeStream, processor, passThrough);
    console.log(`✅ Processed ${lineCount} JSON lines`);
    
  } finally {
    await streamResult.cleanup?.();
  }
}

// ============================================================================
// BEST PRACTICE 5: Concurrent streaming with connection pooling
// ============================================================================

class StreamPool {
  private activeStreams = new Set<FileStreamResult>();
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async stream<T>(
    streamFactory: () => Promise<FileStreamResult>,
    processor: (stream: FileStreamResult) => Promise<T>
  ): Promise<T> {
    // Wait for available slot
    while (this.activeStreams.size >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const streamResult = await streamFactory();
    this.activeStreams.add(streamResult);

    try {
      return await processor(streamResult);
    } finally {
      this.activeStreams.delete(streamResult);
      if (streamResult.cleanup) {
        await streamResult.cleanup();
      }
    }
  }

  async cleanup() {
    // Cleanup all active streams
    const cleanupPromises = Array.from(this.activeStreams).map(async (stream) => {
      if (stream.cleanup) {
        try {
          await stream.cleanup();
        } catch (error) {
          console.warn('Stream cleanup failed:', error);
        }
      }
    });
    
    await Promise.all(cleanupPromises);
    this.activeStreams.clear();
  }
}

async function concurrentStreaming(provider: CrunchyConeProvider, fileIds: string[]) {
  const pool = new StreamPool(3); // Max 3 concurrent streams
  
  try {
    const results = await Promise.all(
      fileIds.map(id => 
        pool.stream(
          () => provider.getFileStreamByExternalId!(id),
          async (streamResult) => {
            const writeStream = createWriteStream(`./downloads/${id}`);
            const nodeStream = streamResult.stream as NodeJS.ReadableStream;
            await pipeline(nodeStream, writeStream);
            return { id, size: streamResult.contentLength };
          }
        )
      )
    );
    
    console.log('✅ All streams completed:', results);
    
  } finally {
    await pool.cleanup();
  }
}

// ============================================================================
// BEST PRACTICE 6: Adaptive streaming based on file size
// ============================================================================

async function adaptiveStreaming(provider: CrunchyConeProvider, externalId: string) {
  // First, get file metadata to decide streaming strategy
  const fileInfo = await provider.findFileByExternalId(externalId);
  if (!fileInfo) {
    throw new Error('File not found');
  }

  const fileSize = fileInfo.size;
  const sizeMB = fileSize / (1024 * 1024);

  if (sizeMB < 10) {
    // Small files: stream everything at once
    console.log(`📁 Small file (${sizeMB.toFixed(2)}MB): streaming in one piece`);
    
    const streamResult = await provider.getFileStreamByExternalId!(externalId);
    try {
      const writeStream = createWriteStream(`./downloads/${externalId}`);
      const nodeStream = streamResult.stream as NodeJS.ReadableStream;
      await pipeline(nodeStream, writeStream);
    } finally {
      await streamResult.cleanup?.();
    }
    
  } else if (sizeMB < 100) {
    // Medium files: stream with progress tracking
    console.log(`📁 Medium file (${sizeMB.toFixed(2)}MB): streaming with progress tracking`);
    await streamWithProgress(provider, externalId);
    
  } else {
    // Large files: use chunked resumable download
    console.log(`📁 Large file (${sizeMB.toFixed(2)}MB): using resumable chunked download`);
    await resumableDownload(provider, externalId, `./downloads/${externalId}`);
  }
}

export {
  safeFileStreaming,
  streamWithProgress,
  resumableDownload,
  processLargeJSONLFile,
  concurrentStreaming,
  adaptiveStreaming,
  ProgressTracker,
  JSONLineProcessor,
  StreamPool,
};