const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());


// Serve static files from the 'images' directory
app.use('/images', express.static('images'));

// In-memory storage (replace with a database in a production environment)
let gallery = [];

app.post('/generate-image', async (req, res) => {
  console.log('Received request with prompt:', req.body.prompt);
  try {
    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      prompt: req.body.prompt,
      n: 1,
      size: "1024x1024"
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('OpenAI API response:', response.data);
    const imageUrl = response.data.data[0].url;
    
    // Download the image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imageResponse.data, 'binary');
    
    // Save the image locally
    const imageName = `image_${Date.now()}.png`;
    const imagePath = path.join(__dirname, 'images', imageName);
    fs.writeFileSync(imagePath, buffer);
    
    // Use the local path for the image URL
    const localImageUrl = `/images/${imageName}`;
    
    gallery.push({ prompt: req.body.prompt, imageUrl: localImageUrl });
    
    res.json({ imageUrl: localImageUrl });
  } catch (error) {
    console.error('Error details:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate image', details: error.response ? error.response.data : error.message });
  }
});

app.get('/gallery', (req, res) => {
  res.json(gallery);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));