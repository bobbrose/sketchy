import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OpenAI } from 'openai';
import fs from 'fs/promises';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Change images directory to use /tmp in production
const imagesDir = process.env.NODE_ENV === 'production' 
  ? '/tmp/sketchy-images'
  : path.join(__dirname, 'images');

// Ensure the images directory exists
fs.mkdir(imagesDir, { recursive: true }).catch(console.error);

// Serve static files from the images directory
app.use('/api/images', express.static(imagesDir));

// Initialize OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const USE_OPENAI_API = process.env.USE_OPENAI_API === 'true';

// In-memory storage for gallery items
let galleryItems = [];

async function saveImage(imageUrl, imageId) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const imageName = `${imageId}.png`;
    const imagePath = path.join(imagesDir, imageName);
    await fs.writeFile(imagePath, buffer);

    return `/api/images/${imageName}`;
  } catch (error) {
    console.error('Error saving image:', error);
    throw new Error('Failed to save image');
  }
}

async function generateMockImage(prompt) {
  // Generate a colorful placeholder image using a third-party service
  const imageId = uuidv4();
  const mockImageUrl = `https://placehold.co/600x400/random/white?text=${encodeURIComponent(prompt)}`;
  
  try {
    const savedImagePath = await saveImage(mockImageUrl, imageId);
    return savedImagePath;
  } catch (error) {
    console.error('Error generating mock image:', error);
    throw new Error('Failed to generate mock image');
  }
}

app.post('/generate-image', async (req, res) => {
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

    let imageUrl;
    if (USE_OPENAI_API) {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: generatedPrompt,
        n: 1,
        size: "1024x1024",
      });
      imageUrl = response.data[0].url;
      const imageId = uuidv4();
      imageUrl = await saveImage(imageUrl, imageId);
    } else {
      imageUrl = generateMockImage(generatedPrompt);
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
app.get('/api/gallery', (req, res) => {
  res.json(galleryItems);
});

// Export for Vercel
export default app;

// Start server only in development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
