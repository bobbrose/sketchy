import React, { useState } from 'react';
import axios from 'axios';

import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://api.openai.com/v1/images/generations', {
        prompt: prompt,
        n: 1,
        size: "1024x1024"
      }, {
        headers: {
          'Authorization': `Bearer YOUR_API_KEY_HERE`,
          'Content-Type': 'application/json'
        }
      });
      setImage(response.data.data[0].url);
    } catch (error) {
      console.error('Error generating image:', error);
    }
  };
  
  return (
    <div className="App">
      <div className="panel left-panel">
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
          />
          <button type="submit">Generate Image</button>
        </form>
      </div>
      <div className="panel right-panel">
        {image ? (
          <img src={image} alt="Generated content" />
        ) : (
          <p>Your generated image will appear here</p>
        )}
      </div>
    </div>
  );
}

export default App;
