import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import { createCanvas } from 'canvas';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'images' directory
app.use('/images', express.static('images'));

// Initialize OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Environment variable to switch between mock and real API
const USE_OPENAI_API = process.env.USE_OPENAI_API === 'true';

// Ensure the 'images' directory exists
const imagesDir = path.join(__dirname, 'images');
fs.mkdir(imagesDir, { recursive: true }).catch(console.error);

// In-memory storage for gallery items
let galleryItems = [];

async function saveImage(imageUrl, imageId) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const imageName = `${imageId}.png`;
    const imagePath = path.join(__dirname, 'images', imageName);
    await fs.writeFile(imagePath, buffer);

    return `/images/${imageName}`;
  } catch (error) {
    console.error('Error saving image:', error);
    throw new Error('Failed to save image');
  }
}

function generateMockImage(prompt) {
  const canvas = createCanvas(500, 500);
  const ctx = canvas.getContext('2d');

  // Generate random colors
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  // Fill the canvas with the random color
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 500, 500);

  // Add some text to the canvas
  ctx.font = '20px Arial';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(`Mock: ${prompt}`, 250, 250);

  // Convert canvas to buffer
  const buffer = canvas.toBuffer('image/png');

  // Save the buffer to a file
  const imageId = uuidv4();
  const imageName = `${imageId}.png`;
  const imagePath = path.join(__dirname, 'images', imageName);
  fs.writeFile(imagePath, buffer).catch(console.error);

  return `/images/${imageName}`;
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
app.get('/gallery', (req, res) => {
  res.json(galleryItems);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
