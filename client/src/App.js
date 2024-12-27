import React, { useState, useEffect } from 'react';
import axios from 'axios';

import './App.css';

// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [prompt, setPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [shareMessage, setShareMessage] = useState('');
console.log("Server: ", API_BASE_URL);
   // Check if the COMING_SOON variable is true, if so show a coming soon page.
   const isComingSoon = process.env.REACT_APP_COMING_SOON === 'true';
   useEffect(() => {
     if (isComingSoon) {
       // Redirect to coming-soon.html
       window.location.href = "/coming-soon.html";
     }
   }, [isComingSoon]);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/gallery`);
      setGallery(response.data);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedPrompt('');
    try {
      const response = await axios.post(`${API_BASE_URL}/generate-image`, { prompt });
      setImage(response.data.imageUrl);
      setGeneratedPrompt(response.data.generatedPrompt);
      setOriginalPrompt(response.data.originalPrompt); // Set the original prompt
      fetchGallery();
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGalleryItemClick = (item) => {
    setPrompt(item.prompt);
    setImage(item.imageUrl);
  };

  const handleShare = () => {
    const imageUrl = `${API_BASE_URL}${image}`;
    navigator.clipboard.writeText(imageUrl).then(() => {
      setShareMessage('Image URL copied to clipboard!');
      setTimeout(() => setShareMessage(''), 3000); // Clear message after 3 seconds
    }, (err) => {
      console.error('Could not copy text: ', err);
      setShareMessage('Failed to copy URL. Please try again.');
    });
  };

  return (
    <div className="App">
      <div className="panel left-panel">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a song or artist..."
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Soundscape'}
          </button>
        </form>
        <div className="gallery">
          {gallery.map((item, index) => (
            <div key={index} className="gallery-item" onClick={() => handleGalleryItemClick(item)}>
              <img src={`${API_BASE_URL}${item.imageUrl}`} alt={item.originalPrompt} />
              <p>{item.originalPrompt}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="panel right-panel">
        {loading && <p>Generating image...</p>}
        {error && <p className="error">{error}</p>}
        {image && !loading && (
          <div>
            <img src={`${API_BASE_URL}${image}`} alt="Generated content" />
            {generatedPrompt && (
              <div className="generated-prompt">
                <h3>Inspired from: "{originalPrompt}"</h3>
                <p>{generatedPrompt}</p>
              </div>
            )}
            <button onClick={handleShare}>Share Image</button>
            {shareMessage && <p>{shareMessage}</p>}
          </div>
        )}
        {!image && !loading && !error && <p>Your generated image will appear here</p>}
      </div>
    </div>
  );
}

export default App;
