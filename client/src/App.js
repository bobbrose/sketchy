import React, { useState, useEffect } from 'react';
import axios from 'axios';

import './App.css';

// Use environment variable for API URL
const API_BASE_URL = process.env.REACT_APP_API_URL;

function App() {
  console.log('API_BASE_URL:', API_BASE_URL);
  const [prompt, setPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [toast, setToast] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
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
    setImage(null); // Clear the previous image
    try {
      const response = await axios.post(`${API_BASE_URL}/generate-image`, { prompt });
      setImage(response.data.imageUrl);
      setGeneratedPrompt(response.data.generatedPrompt);
      setOriginalPrompt(response.data.originalPrompt);
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
    setGeneratedPrompt(item.generatedPrompt);
    setOriginalPrompt(item.originalPrompt);
    setImage(item.imageUrl);
  };

  const handleShare = () => {
    if (!image) return;
    const imageUrl = image;
    navigator.clipboard.writeText(imageUrl).then(() => {
      setToast('Image URL copied to clipboard');
      setTimeout(() => setToast(null), 3000); // Clear toast after 3 seconds
    }, (err) => {
      console.error('Could not copy text: ', err);
      setToast('Failed to copy URL. Please try again.');
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Soundscapes - Create images inspired from bands and songs</h1>
        <button onClick={() => setIsAboutOpen(true)}>About</button>
      </header>
      
      {isAboutOpen && (
        <div className="about-popup">
          <div className="about-content">
            <h2>About Soundscapes</h2>
            <p>Soundscapes is a project that generates images inspired by bands and songs using AI.</p>
            <p>
              <a href="https://github.com/bobbrose/sketchy" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
            </p>
            <p>
              <a href="https://bobbrose.com" target="_blank" rel="noopener noreferrer">Created by Bob Rose</a>
              <p>
                Open source, available under the MIT License.  Feel free to clone and contribute or just learn from it.
                </p>
              <p>
                Created images are shared in gallery - no guarantee of quality or permanence.  Download and save any images you like if you want to keep them.
              </p>
            </p>
            <button onClick={() => setIsAboutOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="panel left-panel">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a song or artist..."
              disabled={loading} // Disable input while loading
            />
            <button type="submit" disabled={loading || !(prompt && prompt.trim())}>
              {loading ? 'Generating...' : 'Generate Soundscape'}
            </button>
          </form>
          <div className="gallery">
            {gallery.map((item, index) => (
              <div key={index} className="gallery-item" onClick={() => handleGalleryItemClick(item)}>
                <img src={item.imageUrl} alt={item.originalPrompt} />
                <p>{item.originalPrompt}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel right-panel">
          {loading && <p>Generating image...</p>}
          {error && <p className="error">{error}</p>}
          {image && !loading && (
            <div className="generated-content">
              <img src={image} alt="Generated content" />
              {generatedPrompt && (
                <div className="generated-prompt">
                  <h3>Inspired from: "{originalPrompt}"</h3>
                  <p>{generatedPrompt}</p>
                </div>
              )}
              <button onClick={handleShare}>Share Image</button>
            </div>
          )}
          {!image && !loading && !error && <p>Your generated image will appear here</p>}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
