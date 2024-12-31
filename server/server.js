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

console.log('Server script is starting...');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Add this near the top of your route definitions
app.get('/api/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Change images directory to use /tmp in production
const imagesDir = process.env.NODE_ENV === 'production' 
  ? '/tmp/sketchy-images'
  : path.join(__dirname, 'images');
console.log('Images Directory:', imagesDir);

// Ensure the images directory exists
fs.mkdir(imagesDir, { recursive: true }).catch(console.error);

// Serve static files from the images directory
app.use('/api/images', express.static(imagesDir));

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

async function saveImage(imageUrl, imageId, metadata = {}) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const imageName = `${imageId}.png`;
    
    if (USE_BLOB_STORE) {
      console.log('Saving image to Blob Store:', imageName);
      console.log('metadata:', metadata);
      const { url } = await put(imageName, buffer, { 
        access: 'public',
        addRandomSuffix: false,
        token: BLOB_STORE_ID,
        metadata: {
          color: 'red',
          originalPrompt: 'ooop',
          generatedPrompt: metadata.generatedPrompt || 'gp'
        }
      });
      console.log('Image saved to Blob Store:', url);
      return url;
    } else {
      const imagePath = path.join(imagesDir, imageName);
      await fs.writeFile(imagePath, buffer);
      console.log('Image saved locally:', imagePath);
      return LOCAL_API_URL + `/images/${imageName}`;
    }
  } catch (error) {
    console.error('Error saving image:', error);
    throw new Error('Failed to save image');
  }
}

async function generateMockImage(prompt) {
  const imageId = uuidv4();
  const mockImageUrl = `https://placehold.co/600x400/random/white?text=${encodeURIComponent(prompt)}`;
  
  try {
    const savedImagePath = await saveImage(mockImageUrl, imageId, { originalPrompt: prompt, generatedPrompt: prompt });
    return savedImagePath;
  } catch (error) {
    console.error('Error generating mock image:', error);
    throw new Error('Failed to generate mock image');
  }
}

app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;

  try {

    // Generate prompt using ChatGPT
    let generatedPrompt;
    if (USE_OPENAI_API) {
      const wrappedPrompt = `Create a vivid and detailed description for an image based on the following song or artist: "${prompt}". The description should be describe the song or artist in vivid detail with speciifc references to the song or something distinctive about the artist so an image can be generated from the description. If there is an iconic logo or visual reference for the band, include that in the image.`;
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
        size: "1024x1024",
      });
      console.log('Got image');

      imageUrl = response.data[0].url;
      const imageId = uuidv4();
      console.log('Image URL:', imageUrl);
      imageUrl = await saveImage(imageUrl, imageId, { originalPrompt: prompt, generatedPrompt: generatedPrompt });
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

    res.json({ 
      imageUrl: imageUrl, 
      generatedPrompt: generatedPrompt,
      originalPrompt: prompt 
    });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image', details: error.message });
  }
});

// Gallery endpoint
app.get('/api/gallery', async (req, res) => {
  if (USE_BLOB_STORE) {
    try {
      const { blobs } = await list({ token: BLOB_STORE_ID });
      const galleryItems = blobs.map(blob => ({
        imageUrl: blob.url,
        generatedPrompt: blob.metadata?.generatedPrompt || '',
        originalPrompt: blob.metadata?.originalPrompt || ''
      }));
      res.json(galleryItems);
    } catch (error) {
      console.error('Error fetching gallery from Blob Store:', error);
      res.status(500).json({ error: 'Failed to fetch gallery' });
    }
  } else {
    res.json(galleryItems);
  }
});

// Clear gallery endpoint
app.delete('/api/clear-gallery', async (req, res) => {
  try {
    if (USE_BLOB_STORE) {
      const { blobs } = await list({ token: BLOB_STORE_ID });
      for (const blob of blobs) {
        await del(blob.url, { token: BLOB_STORE_ID });
      }
    }
    
    galleryItems = [];
    
    res.status(200).json({ message: 'Gallery cleared successfully' });
  } catch (error) {
    console.error('Error clearing gallery:', error);
    res.status(500).json({ error: 'Failed to clear gallery', details: error.message });
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
