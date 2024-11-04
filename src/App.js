import React, { useState } from 'react';
import axios from 'axios';

import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    console.log('API Key (first 5 chars):', apiKey ? apiKey.substring(0, 5) : 'Not set');

    try {
      // First, test the models endpoint
      const modelsResponse = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      console.log('Models retrieval successful', modelsResponse.data);

      // Now, proceed with image generation
      const requestBody = {
        prompt: prompt,
        model: "dall-e-3",
        n: 1,
        size: "1024x1024"
      };
      console.log('Image generation request body:', requestBody);

      const imageResponse = await axios.post('https://api.openai.com/v1/images/generations', 
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Image generation response:', imageResponse.data);
      setImage(imageResponse.data.data[0].url);
    } catch (error) {
      console.error('Error object:', error);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
        if (error.response.data && error.response.data.error) {
          setError(`API Error: ${error.response.data.error.message}`);
        } else {
          setError('Failed to generate image. Please check the console for more details.');
        }
      } else if (error.request) {
        console.error('Error request:', error.request);
        setError('No response received from the server. Please try again.');
      } else {
        console.error('Error message:', error.message);
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
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
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate Image'}
          </button>
        </form>
      </div>
      <div className="panel right-panel">
        {error && <p className="error">{error}</p>}
        {isLoading && <p>Generating image...</p>}
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
