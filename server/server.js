import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import axios from 'axios';
import { put, list, del } from '@vercel/blob';
import { kv } from '@vercel/kv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Add this near the top of your file
const API_KEY = process.env.ADMIN_API_KEY;

// Middleware to check API key
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

// Initialize OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const USE_OPENAI_API = process.env.USE_OPENAI_API === 'true';
const USE_BLOB_STORE = process.env.NODE_ENV === 'production';
const BLOB_STORE_ID = process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_API_URL = 'http://localhost:3001/api'
console.log('Use BLOB_STORE:', USE_BLOB_STORE);
console.log('Use OpenAI API:', USE_OPENAI_API);
console.log('BLOB_STORE_ID:', BLOB_STORE_ID);


// In-memory storage for gallery items
let galleryItems = [];

async function saveImage(imageUrl, imageId) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    const imageName = `${imageId}.png`;

    if (USE_BLOB_STORE) {
      const { url } = await put(imageName, buffer, {
        access: 'public',
        addRandomSuffix: false,
        token: BLOB_STORE_ID
      });
      return url;
    } else {
      const imagePath = path.join(imagesDir, imageName);
      await fs.writeFile(imagePath, buffer);
      console.log('Image saved locally:', imagePath);
      return LOCAL_API_URL + `/images/${imageName}`;
    }
  } catch (error) {
    console.error('Error saving image:', error);
    console.error('Error details:', error.response?.data || error.message);
    throw new Error('Failed to save image');
  }
}

async function generateMockImage(prompt) {
  return `https://placehold.co/600x400?text=${encodeURIComponent(prompt)}`;
}

app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;
  try {

    // Generate prompt using ChatGPT
    let generatedPrompt;
    if (USE_OPENAI_API) {
      const wrappedPrompt = `Create a vivid and detailed description for an image based on the following song or band, under 500 characters, keep it safe and non explicit, use the bands images, iconography, or unique graphics if available: "${prompt}". The description should describe the song or artist in vivid detail with speciifc references to the song or something distinctive about the artist so an image can be generated from the description. If there is an iconic logo or visual reference for the band, include that in the image.`;
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: wrappedPrompt }],
      });

      generatedPrompt = completion.choices[0].message.content.trim();
      console.log('Generated prompt:', generatedPrompt);
    } else {
      generatedPrompt = prompt;
    }
    console.log('Getting image, use openai?', USE_OPENAI_API);

    let imageUrl;
    if (USE_OPENAI_API) {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: generatedPrompt,
        n: 1,
        quality: "standard",
        size: "1024x1024",
      });

      imageUrl = response.data[0].url;
      const imageId = uuidv4();
      console.log('Image URL:', imageUrl);
      imageUrl = await saveImage(imageUrl, imageId);
    } else {
      imageUrl = await generateMockImage(prompt);
    }

    const metadata = {
      originalPrompt: prompt,
      generatedPrompt: generatedPrompt,
      imageUrl: imageUrl,
      createdAt: new Date().toISOString(),
    };

    // Add to gallery
    galleryItems.push(metadata);

    // Store data in KV
    await kv.set(imageUrl, metadata);
    console.log('Data stored in KV');

    console.log('Image generation completed');
    console.log('Response sent:', {
      imageUrl: imageUrl,
      generatedPrompt: generatedPrompt,
      originalPrompt: prompt
    });

    res.json({
      imageUrl: imageUrl,
      generatedPrompt: generatedPrompt,
      originalPrompt: prompt
    });
  } catch (error) {
    console.error('Error in /api/generate-image:', error);
    res.status(500).json({ error: 'Failed to generate image', details: error.message });
  }
});

// Gallery endpoint, not protected, anyone can view the gallery items
app.get('/api/gallery', async (req, res) => {
  if (USE_BLOB_STORE) {
    try {
      const { blobs } = await list({ token: BLOB_STORE_ID });
      console.log('Number of blobs retrieved:', blobs.length);

      const galleryItems = await Promise.all(blobs.map(async (blob) => {
        // Retrieve metadata from KV
        const metadata = await kv.get(blob.url);
        console.log('Data retrieved from KV:', metadata);

        if (metadata) {
          return {
            imageUrl: blob.url,
            originalPrompt: metadata.originalPrompt,
            generatedPrompt: metadata.generatedPrompt,
            createdAt: metadata.createdAt
          };
        } else {
          // Fallback if metadata is not found
          return {
            imageUrl: blob.url,
            createdAt: blob.uploadedAt // Use blob's upload time as fallback
          };
        }
      }));

      // Sort gallery items by creation date, newest first
      galleryItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json(galleryItems);
    } catch (error) {
      console.error('Error fetching gallery from Blob Store:', error);
      res.status(500).json({ error: 'Failed to fetch gallery' });
    }
  } else {
    console.log('Using in-memory gallery items');
    res.json(galleryItems);
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

// Export for Vercel
export default app;

// Start server only in development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

console.log('Server setup complete, ready to handle requests');
