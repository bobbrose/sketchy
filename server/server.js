import express from 'express';
import axios from 'axios';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());


// Serve static files from the 'images' directory
app.use('/images', express.static('images'));

// In-memory storage (replace with a database in a production environment)
let gallery = [];

// Environment variable to switch between mock and real API
// Function to log gallery contents
function logGallery() {
  console.log('Current gallery contents:');
  gallery.forEach((item, index) => {
    console.log(`${index + 1}. Prompt: "${item.prompt}", Image: ${item.imageUrl}`);
  });
  console.log('Total items in gallery:', gallery.length);
}
const USE_OPENAI_API = process.env.USE_OPENAI_API === 'true';

// Mock image generation function
function generateMockImage(prompt) {
  const mockImageName = `mock_image_${Date.now()}.png`;
  const mockImagePath = path.join(__dirname, 'images', mockImageName);
  
  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');

  // Fill background with random color
  ctx.fillStyle = `#${Math.floor(Math.random()*16777215).toString(16)}`;
  ctx.fillRect(0, 0, 1024, 1024);

  // Add text
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Mock Image: ${prompt}`, 512, 512);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(mockImagePath, buffer);

  return `/images/${mockImageName}`;
}

// Real API call function
async function generateRealImage(prompt) {
  const response = await axios.post('https://api.openai.com/v1/images/generations', {
    model: "dall-e-3",  // Specify the latest DALL-E model
    prompt: prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard"  // You can change this to "hd" for higher quality
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  console.log('Response from OpenAI API:', response.data);
  const imageUrl = response.data.data[0].url;
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(imageResponse.data, 'binary');
  
  const imageName = `image_${Date.now()}.png`;
  const imagePath = path.join(__dirname, 'images', imageName);
  fs.writeFileSync(imagePath, buffer);
  
  return `/images/${imageName}`;
}

app.post('/generate-image', async (req, res) => {
  console.log('Received request with prompt:', req.body.prompt);
  try {
    let localImageUrl;
    if (USE_OPENAI_API) {
      console.log('Using OpenAI API');
      localImageUrl = await generateRealImage(req.body.prompt);
    } else {
      console.log('Using mock API');
      localImageUrl = generateMockImage(req.body.prompt);
    }
    
    gallery.push({ prompt: req.body.prompt, imageUrl: localImageUrl });
    //console.log('Image generated and added to gallery');
    //logGallery();
    res.json({ imageUrl: localImageUrl });
  } catch (error) {
    console.error('Error details:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate image', details: error.response ? error.response.data : error.message });
  }
});

app.get('/gallery', (req, res) => {
  console.log('Gallery requested');
  //logGallery();
  res.json(gallery);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));