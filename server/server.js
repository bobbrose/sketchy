import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { put, list, del } from '@vercel/blob';
import { kv } from '@vercel/kv';
import compression from 'compression';
import Jimp from 'jimp';
import { generateArtDirectedPrompt, generateImageWithSafetyFallback, generateMockImage } from './imageGeneration.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cross-origin calls only ever come from local dev (client on :3000, server
// on :3001) or a Vercel preview/production deployment - in production the
// client calls its own API same-origin (REACT_APP_API_URL=/api), so this
// only matters for blocking some other site from scripting calls to the
// (paid, OpenAI-backed) API through a visitor's browser.
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:3000$/,
  /^https:\/\/([a-z0-9-]+\.)?sketchyai\.app$/,
  /^https:\/\/sketchy(-[a-z0-9]+)?-bobbroses-projects\.vercel\.app$/,
  /^https:\/\/sketchy-orpin\.vercel\.app$/,
];

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    // No Origin header means same-origin (or a non-browser client, e.g.
    // curl/server-to-server) - not something CORS can or should police.
    if (!origin || ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
      return callback(null, true);
    }
    // Deny without throwing: the browser still blocks the request client-side
    // for lacking an Access-Control-Allow-Origin header either way, but this
    // avoids logging every blocked probe as a noisy 500.
    callback(null, false);
  },
}));
app.use(express.json());
// Skip compression on the streaming generate-image route: compression
// buffers writes until it has enough data to decide whether to compress,
// which would hold back the progress events below until the whole response
// is ready - defeating the point of streaming them.
app.use(compression({
  filter: (req, res) => {
    if (req.path === '/api/generate-image') return false;
    return compression.filter(req, res);
  }
}));

// Custom cache control middleware
const setCacheControl = (req, res, next) => {
  if (req.url.startsWith('/api/images/')) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  next();
};

app.use(setCacheControl);

// Add this near the top of your file
const API_KEY = process.env.ADMIN_API_KEY;

// API key check middleware
const checkApiKey = (req, res, next) => {
  const providedApiKey = req.query.api_key || req.headers['x-api-key'];
  
  if (!API_KEY) {
    console.error('ADMIN_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (providedApiKey !== API_KEY) {
    console.log('Unauthorized API access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Add this near the top of your route definitions
app.get('/api/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Change images directory to use /tmp in production
const imagesDir = process.env.NODE_ENV === 'production'
  ? null
  : path.join(__dirname, 'images');

// Ensure the images directory exists and serve static files only in development
if (process.env.NODE_ENV !== 'production' && imagesDir) {
  fs.mkdir(imagesDir, { recursive: true })
    .then(() => {
      app.use('/api/images', express.static(imagesDir));
      console.log('Images directory created and static serving enabled');
    })
    .catch(error => {
      console.error('Error creating images directory:', error);
    });
}

const USE_OPENAI_API = process.env.USE_OPENAI_API === 'true';
const USE_BLOB_STORE = process.env.NODE_ENV === 'production';
const BLOB_STORE_ID = process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_API_URL = 'http://localhost:3001/api'
console.log('Use BLOB_STORE:', USE_BLOB_STORE);
console.log('Use OpenAI API:', USE_OPENAI_API);
console.log('BLOB_STORE_ID:', BLOB_STORE_ID);


// In-memory storage for gallery items
let galleryItems = [];

async function createThumbnail(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    console.log('Creating thumbnail...');
    return await image
      .cover(300, 300) // Similar to sharp's 'cover' fit
      .quality(80)     // Set JPEG quality
      .getBufferAsync(Jimp.MIME_JPEG);
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    throw error;
  }
}

async function saveImage(buffer, imageId) {
  try {
    // Create thumbnail using Jimp
    const thumbnailBuffer = await createThumbnail(buffer);
    
    const imageName = `${imageId}.png`;
    const thumbnailName = `${imageId}_thumb.jpg`;

    if (USE_BLOB_STORE) {
      // Save main image
      const { url: mainUrl } = await put(imageName, buffer, {
        access: 'public',
        addRandomSuffix: false,
        token: BLOB_STORE_ID
      });

      // Save thumbnail
      const { url: thumbUrl } = await put(thumbnailName, thumbnailBuffer, {
        access: 'public',
        addRandomSuffix: false,
        token: BLOB_STORE_ID
      });
      console.log('Image and thumbnail saved to Blob Store:', mainUrl, thumbUrl);
      return {
        imageUrl: mainUrl,
        thumbnailUrl: thumbUrl
      };
    } else {
      // Local storage
      const imagePath = path.join(imagesDir, imageName);
      const thumbnailPath = path.join(imagesDir, thumbnailName);
      
      await fs.writeFile(imagePath, buffer);
      await fs.writeFile(thumbnailPath, thumbnailBuffer);
      
      console.log('Image and thumbnail saved locally:', imagePath);
      
      return {
        imageUrl: `${LOCAL_API_URL}/images/${imageName}`,
        thumbnailUrl: `${LOCAL_API_URL}/images/${thumbnailName}`
      };
    }
  } catch (error) {
    console.error('Error saving image:', error);
    console.error('Error details:', error.response?.data || error.message);
    throw new Error('Failed to save image');
  }
}

// Per-IP rate limit for the one endpoint that actually costs money (it
// calls OpenAI). Backed by Vercel KV rather than an in-memory counter,
// since serverless invocations don't share memory - a fresh instance would
// otherwise reset the count on every request. Configurable via env vars so
// the limit can be tuned without a code change.
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 8;
const RATE_LIMIT_WINDOW_SECONDS = Number(process.env.RATE_LIMIT_WINDOW_SECONDS) || 600; // 10 minutes

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.socket.remoteAddress;
}

// Returns true if this IP is still under its limit (and counts this call
// against it); false if it should be rejected.
async function checkRateLimit(ip) {
  const key = `ratelimit:generate-image:${ip}`;
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  return count <= RATE_LIMIT_MAX_REQUESTS;
}

app.post('/api/generate-image', async (req, res) => {
  const { prompt, creatorId } = req.body;

  const clientIp = getClientIp(req);
  if (!(await checkRateLimit(clientIp))) {
    console.warn('Rate limit exceeded for', clientIp);
    res.status(429).setHeader('Content-Type', 'application/x-ndjson');
    res.write(JSON.stringify({
      status: 'error',
      error: "You're generating a bit fast - please wait a few minutes and try again.",
    }) + '\n');
    return res.end();
  }

  // Stream progress as newline-delimited JSON so the client can show real
  // status transitions (e.g. "now creating the thumbnail") instead of
  // guessing at timings. The HTTP status is always 200 once streaming
  // starts - success/failure is signaled by the final "done"/"error" event
  // instead, since headers can't change after the first write.
  res.setHeader('Content-Type', 'application/x-ndjson');
  const sendEvent = (data) => res.write(JSON.stringify(data) + '\n');

  try {
    // Generate prompt using ChatGPT (see imageGeneration.js for the "art
    // direction" step and why it uses gpt-4o-mini)
    let generatedPrompt;
    if (USE_OPENAI_API) {
      generatedPrompt = await generateArtDirectedPrompt(prompt);
      console.log('Generated prompt:', generatedPrompt);
    } else {
      generatedPrompt = prompt;
    }
    console.log('Getting image, use openai?', USE_OPENAI_API);
    sendEvent({ status: 'creating-image' });

    let imageUrl, thumbnailUrl;
    if (USE_OPENAI_API) {
      const result = await generateImageWithSafetyFallback(generatedPrompt);
      const response = result.response;
      generatedPrompt = result.generatedPrompt;

      sendEvent({ status: 'creating-thumbnail' });

      const imageId = uuidv4();
      const buffer = Buffer.from(response.data[0].b64_json, 'base64');
      const urls = await saveImage(buffer, imageId);
      imageUrl = urls.imageUrl;
      thumbnailUrl = urls.thumbnailUrl;
    } else {
      imageUrl = await generateMockImage(prompt);
      thumbnailUrl = imageUrl; // For mock images, use same URL
    }

    const metadata = {
      originalPrompt: prompt,
      generatedPrompt: generatedPrompt,
      imageUrl: imageUrl,
      thumbnailUrl: thumbnailUrl,
      createdAt: new Date().toISOString(),
      // Anonymous per-browser id (see the cookie in App.js), used only to
      // let someone delete their own image later via /api/my-image. Not
      // sent back in the client-facing response - the client already knows
      // its own id.
      creatorId: typeof creatorId === 'string' ? creatorId : null,
    };

    // Add to gallery
    galleryItems.push(metadata);

    // Store data in KV
    await kv.set(imageUrl, metadata);
    console.log('Data stored in KV');

    console.log('Image generation completed');
    sendEvent({
      status: 'done',
      result: {
        imageUrl: imageUrl,
        thumbnailUrl: thumbnailUrl,
        generatedPrompt: generatedPrompt,
        originalPrompt: prompt,
        createdAt: metadata.createdAt
      }
    });
  } catch (error) {
    console.error('Error in /api/generate-image:', error);
    if (error.isSafetyBlocked) {
      sendEvent({ status: 'error', error: error.message });
    } else {
      sendEvent({ status: 'error', error: 'Failed to generate image', details: error.message });
    }
  } finally {
    res.end();
  }
});

// Gallery endpoint, not protected, anyone can view the gallery items
app.get('/api/gallery', async (req, res) => {
  const requestingCreatorId = typeof req.query.creatorId === 'string' ? req.query.creatorId : null;

  if (USE_BLOB_STORE) {
    try {
      const { blobs } = await list({ token: BLOB_STORE_ID });
      console.log('Number of blobs retrieved:', blobs.length);

      // Filter out thumbnail blobs and sort by uploadedAt
      const mainBlobs = blobs
        .filter(blob => !blob.pathname.includes('_thumb'))
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      // Limit the number of items to process and return
      const MAX_ITEMS = 150;
      const limitedBlobs = mainBlobs.slice(0, MAX_ITEMS);

      const galleryItems = await Promise.all(limitedBlobs.map(async (blob) => {
        const metadata = await kv.get(blob.url);
        console.log('Metadata for blob:', blob.url, metadata);
        if (metadata) {
          return {
            imageUrl: metadata.imageUrl,
            thumbnailUrl: metadata.thumbnailUrl || metadata.imageUrl, // Fallback to main image if no thumbnail
            originalPrompt: metadata.originalPrompt,
            generatedPrompt: metadata.generatedPrompt,
            createdAt: metadata.createdAt,
            // Never echo the raw creatorId - this is a public, unauthenticated
            // endpoint, so broadcasting it would let anyone read another
            // visitor's id and spoof it to delete their images. Only whether
            // *this* requester (identified by their own ?creatorId= query
            // param) matches is safe to reveal.
            isOwner: !!requestingCreatorId && metadata.creatorId === requestingCreatorId
          };
        } else {
          return {
            imageUrl: blob.url,
            thumbnailUrl: blob.url, // Fallback to main image if no thumbnail
            createdAt: blob.uploadedAt,
            isOwner: false // no metadata means no recorded creatorId either
          };
        }
      }));

      res.json({
        galleryItems: galleryItems,
        totalItems: mainBlobs.length,
        returnedItems: galleryItems.length
      });
    } catch (error) {
      console.error('Error fetching gallery from Blob Store:', error);
      res.status(500).json({ error: 'Failed to fetch gallery' });
    }
  } else {
    console.log('Using in-memory gallery items');
    // Newest first, to match the blob-store branch above (items are pushed
    // in generation order, which isn't necessarily newest-createdAt-first).
    const sortedItems = [...galleryItems]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      // Same reasoning as the blob-store branch: strip the raw creatorId
      // and replace it with a per-requester isOwner flag instead, so this
      // public endpoint never broadcasts anyone's id.
      .map(({ creatorId, ...item }) => ({
        ...item,
        isOwner: !!requestingCreatorId && creatorId === requestingCreatorId
      }));
    res.json(sortedItems);
  }
});

// Clear gallery endpoint, protected by API key, should only be called by admin
app.delete('/api/clear-gallery', checkApiKey, async (req, res) => {
  try {
    if (USE_BLOB_STORE) {
      const { blobs } = await list({ token: BLOB_STORE_ID });
      console.log('Number of blobs to delete:', blobs.length);

      for (const blob of blobs) {
        // Delete the blob
        await del(blob.url, { token: BLOB_STORE_ID });
        console.log('Deleted blob:', blob.url);

        // Delete the corresponding KV entry
        await kv.del(blob.url);
        console.log('Deleted KV entry for:', blob.url);
      }
    }

    // Clear in-memory gallery items
    galleryItems = [];

    console.log('Gallery cleared successfully');

    res.status(200).json({ message: 'Gallery cleared successfully' });
  } catch (error) {
    console.error('Error clearing gallery:', error);
    res.status(500).json({ error: 'Failed to clear gallery', details: error.message });
  }
});

// Function to remove an image from Blob Store and KV store
async function removeImage(imageUrl) {
  if (USE_BLOB_STORE) {
    try {
      // Extract the pathname from the URL
      const url = new URL(imageUrl);
      const pathname = url.pathname.slice(1); // Remove leading slash

      console.log('Attempting to delete blob:', pathname);
      
      // Delete the blob
      await del(pathname, { token: BLOB_STORE_ID });
      console.log('Blob deleted successfully');

      // Also delete the matching thumbnail blob, if any (mirrors the
      // pairing logic in /api/reduce-gallery) - otherwise it's orphaned.
      const thumbPathname = pathname.replace(/\.png$/, '_thumb.jpg');
      try {
        await del(thumbPathname, { token: BLOB_STORE_ID });
        console.log('Thumbnail blob deleted successfully');
      } catch (thumbError) {
        console.warn('No matching thumbnail blob to delete (or already gone):', thumbError.message);
      }

      // Remove the metadata from KV store
      await kv.del(imageUrl);
      console.log('Metadata removed from KV store');

      return true;
    } catch (error) {
      console.error('Error removing image:', error);
      return false;
    }
  } else {
    // For local storage, remove from in-memory gallery
    const index = galleryItems.findIndex(item => item.imageUrl === imageUrl);
    if (index !== -1) {
      galleryItems.splice(index, 1);
      console.log('Image removed from in-memory gallery');
      return true;
    }
    return false;
  }
}

// Endpoint to remove an image, protected by API key, should only be called by admin
app.delete('/api/remove-image', checkApiKey, async (req, res) => {
  const { imageUrl } = req.body;
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'Image URL is required' });
  }

  console.log('Received request to remove image:', imageUrl);

  const success = await removeImage(imageUrl);

  if (success) {
    res.json({ message: 'Image removed successfully' });
  } else {
    res.status(500).json({ error: 'Failed to remove image' });
  }
});

// Lets a visitor delete an image they made themselves, identified by the
// anonymous creatorId cookie set client-side (see App.js) - not admin-gated,
// ownership is the check instead. This is a soft check, not real auth: a
// client that already knew someone else's creatorId could spoof it, but
// there's no login system here, and /api/gallery deliberately never
// broadcasts anyone's raw creatorId (see the isOwner computation there), so
// there's no way to learn one just by using the app normally. An acceptable
// bar for a hobby app's "let people clean up their own stuff" feature.
app.delete('/api/my-image', async (req, res) => {
  const { imageUrl, creatorId: requestingCreatorId } = req.body;

  if (!imageUrl || !requestingCreatorId) {
    return res.status(400).json({ error: 'imageUrl and creatorId are required' });
  }

  let ownerCreatorId;
  if (USE_BLOB_STORE) {
    const metadata = await kv.get(imageUrl);
    ownerCreatorId = metadata?.creatorId;
  } else {
    const item = galleryItems.find(item => item.imageUrl === imageUrl);
    ownerCreatorId = item?.creatorId;
  }

  if (!ownerCreatorId || ownerCreatorId !== requestingCreatorId) {
    return res.status(403).json({ error: 'You can only delete images you created' });
  }

  const success = await removeImage(imageUrl);

  if (success) {
    res.json({ message: 'Image deleted successfully' });
  } else {
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Add this new endpoint after the clear-gallery endpoint
app.post('/api/reduce-gallery', checkApiKey, async (req, res) => {
  const { count } = req.body;
  
  if (!count || isNaN(count) || count < 0) {
    return res.status(400).json({ error: 'Invalid count provided' });
  }

  try {
    if (USE_BLOB_STORE) {
      const { blobs } = await list({ token: BLOB_STORE_ID });
      console.log('Total number of blobs:', blobs.length);

      // Count and sort by main images only, ignoring thumbnail blobs, so
      // "count" refers to actual gallery items rather than raw blobs (each
      // item is 2 blobs: the main image + its thumbnail).
      const mainBlobs = blobs.filter(blob => !blob.pathname.includes('_thumb'));
      const thumbBlobs = blobs.filter(blob => blob.pathname.includes('_thumb'));

      // Sort main blobs by uploadedAt, newest first
      mainBlobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      // Keep only the specified number of most recent images
      const mainBlobsToDelete = mainBlobs.slice(count);
      console.log('Number of images to delete:', mainBlobsToDelete.length);

      for (const blob of mainBlobsToDelete) {
        // Delete the main image blob
        await del(blob.url, { token: BLOB_STORE_ID });
        console.log('Deleted blob:', blob.url);

        // Delete the matching thumbnail blob, if any
        const thumbPathname = blob.pathname.replace(/\.png$/, '_thumb.jpg');
        const thumbBlob = thumbBlobs.find(t => t.pathname === thumbPathname);
        if (thumbBlob) {
          await del(thumbBlob.url, { token: BLOB_STORE_ID });
          console.log('Deleted thumbnail blob:', thumbBlob.url);
        }

        // Delete the corresponding KV entry (keyed by main image URL)
        await kv.del(blob.url);
        console.log('Deleted KV entry for:', blob.url);
      }

      res.status(200).json({
        message: `Gallery reduced successfully. Kept ${count} most recent images, deleted ${mainBlobsToDelete.length} images.`
      });
    } else {
      // For in-memory storage
      galleryItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const deletedCount = Math.max(0, galleryItems.length - count);
      galleryItems = galleryItems.slice(0, count);
      
      res.status(200).json({ 
        message: `Gallery reduced successfully. Kept ${count} most recent images, deleted ${deletedCount} images.` 
      });
    }
  } catch (error) {
    console.error('Error reducing gallery:', error);
    res.status(500).json({ error: 'Failed to reduce gallery', details: error.message });
  }
});

// Export for Vercel
export default app;

// Start server only in development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

console.log('Server setup complete, ready to handle requests');
