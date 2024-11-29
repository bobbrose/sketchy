import React, { useState, useEffect } from 'react';
import axios from 'axios';

import './App.css';

const API_BASE_URL = 'http://localhost:3001';

function App() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [shareMessage, setShareMessage] = useState('');

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
    console.log('Sending request with prompt:', prompt);
    try {
      const response = await axios.post(`${API_BASE_URL}/generate-image`, { prompt });
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
          {gallery.map((item, index) => (
            <div key={index} className="gallery-item" onClick={() => handleGalleryItemClick(item)}>
              <img src={`${API_BASE_URL}${item.imageUrl}`} alt={item.prompt} />
              <p>{item.prompt}</p>
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
