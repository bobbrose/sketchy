const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (replace with a database in a production environment)
let gallery = [];

app.post('/generate-image', async (req, res) => {
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
    
    const imageUrl = response.data.data[0].url;
    
    // Save the prompt and image URL to the gallery
    gallery.push({ prompt: req.body.prompt, imageUrl });
    
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

app.get('/gallery', (req, res) => {
  res.json(gallery);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));