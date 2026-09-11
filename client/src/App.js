import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';

// Use environment variable for API URL
const API_BASE_URL = process.env.REACT_APP_API_URL;

  console.log('API_BASE_URL:', API_BASE_URL);

// The common "share" glyph (three connected nodes), rendered inline so no
// icon library/asset is needed.
const ShareIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

function App() {
  const [prompt, setPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [createdAt, setCreatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [toast, setToast] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [cachedImages, setCachedImages] = useState({});

  // Image URL passed in via ?image= on load, so a shared link opens straight
  // to that image. Read once on mount; enriched with its prompt/date below
  // once the gallery loads.
  const [sharedImageUrl] = useState(
    () => new URLSearchParams(window.location.search).get('image')
  );
  const sharedImageEnriched = useRef(false);

  const cacheImage = useCallback((imageUrl) => {
    if (!cachedImages[imageUrl]) {
      const img = new Image();
      img.src = imageUrl;
      setCachedImages(prev => ({ ...prev, [imageUrl]: img }));
    }
  }, [cachedImages]);

  // Check if the COMING_SOON variable is true, if so show a coming soon page.
  const isComingSoon = process.env.REACT_APP_COMING_SOON === 'true';
  useEffect(() => {
    if (isComingSoon) {
      // Redirect to coming-soon.html
      window.location.href = "/coming-soon.html";
    }
  }, [isComingSoon]);

  const fetchGallery = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/gallery`);
      let galleryItems = [];

      if (Array.isArray(response.data)) {
        // New structure: direct array
        galleryItems = response.data;
      } else if (response.data && Array.isArray(response.data.galleryItems)) {
        // Old structure: object with galleryItems property
        galleryItems = response.data.galleryItems;
      } else {
        console.error('Unexpected gallery data structure:', response.data);
      }

      setGallery(galleryItems);
      galleryItems.forEach(item => {
        cacheImage(item.thumbnailUrl || item.imageUrl);
        cacheImage(item.imageUrl);
      });
    } catch (error) {
      console.error('Error fetching gallery:', error);
      setGallery([]);
    }
  }, [cacheImage]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  // Show the shared image right away, before the gallery has even loaded.
  useEffect(() => {
    if (sharedImageUrl) {
      setImage(sharedImageUrl);
      cacheImage(sharedImageUrl);
    }
    // Only ever run this for the URL the page loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the gallery loads, fill in the shared image's prompt/date if we
  // have it on record.
  useEffect(() => {
    if (!sharedImageUrl || sharedImageEnriched.current || !gallery.length) return;
    const match = gallery.find(
      item => item.imageUrl === sharedImageUrl || item.thumbnailUrl === sharedImageUrl
    );
    if (match) {
      setOriginalPrompt(match.originalPrompt || '');
      setGeneratedPrompt(match.generatedPrompt || '');
      setCreatedAt(match.createdAt || null);
      sharedImageEnriched.current = true;
    }
  }, [gallery, sharedImageUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedPrompt('');
    setImage(null); // Clear the previous image
    setCreatedAt(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/generate-image`, { prompt });
      setImage(response.data.imageUrl);
      setGeneratedPrompt(response.data.generatedPrompt);
      setOriginalPrompt(response.data.originalPrompt);
      setCreatedAt(response.data.createdAt);
      fetchGallery();
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGalleryItemClick = (item) => {
    setPrompt(item.prompt || ''); // Ensure it's never undefined
    setGeneratedPrompt(item.generatedPrompt || '');
    setOriginalPrompt(item.originalPrompt || '');
    setImage(item.imageUrl || null);
    setCreatedAt(item.createdAt || null);
  };

  const formatCreatedAt = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const handleShare = () => {
    if (!image) return;
    // Link to the app itself with this image's URL attached, so opening the
    // link brings this image up instead of just the raw image file.
    const shareUrl = new URL(window.location.href);
    shareUrl.search = '';
    shareUrl.searchParams.set('image', image);

    navigator.clipboard.writeText(shareUrl.toString()).then(() => {
      setToast('Share link copied to clipboard');
      setTimeout(() => setToast(null), 3000); // Clear toast after 3 seconds
    }, (err) => {
      console.error('Could not copy text: ', err);
      setToast('Failed to copy link. Please try again.');
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Soundscapes - Create images inspired from musical artists and songs</h1>
        <button onClick={() => setIsAboutOpen(true)}>About</button>
      </header>
      
      {isAboutOpen && (
        <div className="about-popup">
          <div className="about-content">
            <h2>Soundscapes</h2>
            <p>Soundscapes is a project that generates images inspired by bands and songs.</p>
            <p>
              <a href="https://github.com/bobbrose/sketchy" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
            </p>
            <p>
              <a href="https://bobbrose.com" target="_blank" rel="noopener noreferrer">Created by Bob Rose</a>
            </p>
            <p>Open source MIT License.</p>
            <p>
              Created images are shared in gallery - no guarantee of quality or permanence. Download and save any images you like if you want to keep them.
            </p>
            <p>
              Created with <a href="https://www.augmentcode.com/" target="_blank" rel="noopener noreferrer">Augment Code</a> and <a href="https://claude.com/claude-code" target="_blank" rel="noopener noreferrer">Claude</a>
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
                <img 
                  src={cachedImages[item.thumbnailUrl] ? cachedImages[item.thumbnailUrl].src : (item.thumbnailUrl || item.imageUrl)} 
                  alt={item.originalPrompt || ''} 
                />
                <p>{item.originalPrompt || ''}</p>
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
              {formatCreatedAt(createdAt) && (
                <p className="created-at">Created {formatCreatedAt(createdAt)}</p>
              )}
              {generatedPrompt && (
                <div className="generated-prompt">
                  <h3>Inspired from: "{originalPrompt}"</h3>
                  <p>{generatedPrompt}</p>
                </div>
              )}
              <button className="share-button" onClick={handleShare}>
                <ShareIcon /> Share
              </button>
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
