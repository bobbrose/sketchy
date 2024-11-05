import React, { useState, useEffect } from 'react';
import axios from 'axios';

import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const response = await axios.get('http://localhost:3001/gallery');
      setGallery(response.data);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log('Sending request with prompt:', prompt);
    try {
      const response = await axios.post('http://localhost:3001/generate-image', { prompt });
      console.log('Received response:', response.data);
      setImage(response.data.imageUrl);
      fetchGallery(); // Refresh the gallery after generating a new image
    } catch (error) {
      console.error('Error generating image:', error.response ? error.response.data : error.message);
      setError('Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGalleryItemClick = (item) => {
    setPrompt(item.prompt);
    setImage(item.imageUrl);
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
          <button type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Image'}
          </button>
        </form>
        <div className="gallery">
          <h2>Gallery</h2>
          {gallery.map((item, index) => (
            <div key={index} className="gallery-item" onClick={() => handleGalleryItemClick(item)}>
              <p>{item.prompt}</p>
              <img src={item.imageUrl} alt={item.prompt} />
            </div>
          ))}
        </div>
      </div>
      <div className="panel right-panel">
        {loading && <p>Generating image...</p>}
        {error && <p className="error">{error}</p>}
        {image && !loading && (
          <div>
            <img src={image} alt="Generated content" />
            <button onClick={handleSubmit}>Regenerate</button>
          </div>
        )}
        {!image && !loading && !error && <p>Your generated image will appear here</p>}
      </div>
    </div>
  );
}

export default App;
