import { CrunchyConeProvider } from '../src/services/storage/providers/crunchycone';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// Initialize the provider
const provider = new CrunchyConeProvider({
  apiUrl: 'https://api.crunchycone.com',
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
});

// Example 1: Basic file streaming
async function streamFileToLocalDisk() {
  console.log('📥 Streaming file to local disk...');
  
  const streamResult = await provider.getFileStreamByExternalId('my-document');
  
  console.log(`📊 File info:
    - Content Type: ${streamResult.contentType}
    - Size: ${streamResult.contentLength} bytes
    - Last Modified: ${streamResult.lastModified}
    - Supports ranges: ${streamResult.acceptsRanges}`);

  // Stream to local file
  const writeStream = createWriteStream('./downloaded-file.pdf');
  
  try {
    await pipeline(streamResult.stream as NodeJS.ReadableStream, writeStream);
    console.log('✅ File downloaded successfully');
  } finally {
    // Always cleanup
    if (streamResult.cleanup) {
      await streamResult.cleanup();
    }
  }
}

// Example 2: Range request (partial content)
async function streamPartialFile() {
  console.log('📥 Streaming partial file (first 1MB)...');
  
  const streamResult = await provider.getFileStream('files/large-video.mp4', {
    start: 0,
    end: 1024 * 1024 - 1, // First 1MB
  });

  if (streamResult.isPartialContent && streamResult.range) {
    console.log(`📊 Partial content:
      - Range: ${streamResult.range.start}-${streamResult.range.end}
      - Total size: ${streamResult.range.total} bytes`);
  }

  // Process the partial stream
  const chunks: Buffer[] = [];
  const stream = streamResult.stream as NodeJS.ReadableStream;
  
  stream.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  stream.on('end', () => {
    const data = Buffer.concat(chunks);
    console.log(`✅ Received ${data.length} bytes`);
  });
}

// Example 3: HTTP response streaming with Express
import express from 'express';

const app = express();

app.get('/files/:externalId', async (req, res) => {
  try {
    const { externalId } = req.params;
    
    // Parse range header if present
    const range = req.headers.range;
    let streamOptions = {};
    
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        streamOptions = {
          start: parseInt(match[1]),
          end: match[2] ? parseInt(match[2]) : undefined,
        };
      }
    }

    const streamResult = await provider.getFileStreamByExternalId(externalId, streamOptions);

    // Set appropriate headers
    res.setHeader('Content-Type', streamResult.contentType);
    
    if (streamResult.isPartialContent && streamResult.range) {
      res.status(206);
      res.setHeader('Content-Range', 
        `bytes ${streamResult.range.start}-${streamResult.range.end}/${streamResult.range.total}`);
      res.setHeader('Content-Length', streamResult.range.end - streamResult.range.start + 1);
    } else if (streamResult.contentLength) {
      res.setHeader('Content-Length', streamResult.contentLength);
    }

    if (streamResult.acceptsRanges) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    if (streamResult.lastModified) {
      res.setHeader('Last-Modified', streamResult.lastModified.toUTCString());
    }

    if (streamResult.etag) {
      res.setHeader('ETag', streamResult.etag);
    }

    // Stream the file to the response
    const nodeStream = streamResult.stream as NodeJS.ReadableStream;
    
    // Handle client disconnect
    req.on('close', async () => {
      nodeStream.destroy();
      if (streamResult.cleanup) {
        await streamResult.cleanup();
      }
    });

    // Pipe to response
    nodeStream.pipe(res);

  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({ error: 'Failed to stream file' });
  }
});

// Example 4: Web stream usage for browser environments
async function streamForBrowser() {
  const streamResult = await provider.getFileStream('files/image.jpg', {
    responseType: 'web', // Get a Web ReadableStream
  });

  if (typeof window !== 'undefined') {
    // Browser environment - create a blob URL
    const stream = streamResult.stream as ReadableStream;
    const response = new Response(stream);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    // Use the blob URL for display
    const img = document.createElement('img');
    img.src = url;
    document.body.appendChild(img);
    
    // Cleanup when done
    img.onload = () => {
      URL.revokeObjectURL(url);
    };
  }
}

// Example 5: Streaming with progress tracking
async function streamWithProgress() {
  console.log('📥 Streaming with progress tracking...');
  
  const streamResult = await provider.getFileStreamByExternalId('large-file');
  const totalSize = streamResult.contentLength || 0;
  let downloadedBytes = 0;

  const stream = streamResult.stream as NodeJS.ReadableStream;
  
  stream.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    const percentage = totalSize > 0 ? Math.round((downloadedBytes / totalSize) * 100) : 0;
    console.log(`📊 Progress: ${percentage}% (${downloadedBytes}/${totalSize} bytes)`);
  });

  stream.on('end', () => {
    console.log('✅ Download completed');
  });

  // Pipe to destination (example: local file)
  const writeStream = createWriteStream('./progress-download.file');
  await pipeline(stream, writeStream);
}

// Example 6: Error handling and cancellation
async function streamWithCancellation() {
  console.log('📥 Streaming with cancellation support...');
  
  const controller = new AbortController();
  
  // Cancel after 5 seconds
  setTimeout(() => {
    console.log('⏰ Cancelling stream...');
    controller.abort();
  }, 5000);

  try {
    const streamResult = await provider.getFileStream('files/huge-file.bin', {
      signal: controller.signal,
      timeout: 10000, // 10 second timeout
    });

    const stream = streamResult.stream as NodeJS.ReadableStream;
    const writeStream = createWriteStream('./cancelled-download.file');
    
    await pipeline(stream, writeStream);
    console.log('✅ Stream completed');
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('🛑 Stream was cancelled');
    } else {
      console.error('❌ Stream error:', error);
    }
  }
}

// Example 7: Multiple concurrent streams
async function concurrentStreams() {
  console.log('📥 Streaming multiple files concurrently...');
  
  const fileIds = ['file1', 'file2', 'file3'];
  
  const streams = await Promise.all(
    fileIds.map(async (id, index) => {
      const streamResult = await provider.getFileStreamByExternalId(id);
      const writeStream = createWriteStream(`./concurrent-${index}.file`);
      
      return {
        id,
        pipeline: pipeline(streamResult.stream as NodeJS.ReadableStream, writeStream),
        cleanup: streamResult.cleanup,
      };
    })
  );

  try {
    await Promise.all(streams.map(s => s.pipeline));
    console.log('✅ All streams completed');
  } finally {
    // Cleanup all streams
    await Promise.all(
      streams.map(s => s.cleanup && s.cleanup()).filter(Boolean)
    );
  }
}

export {
  streamFileToLocalDisk,
  streamPartialFile,
  streamForBrowser,
  streamWithProgress,
  streamWithCancellation,
  concurrentStreams,
  app, // Express server example
};