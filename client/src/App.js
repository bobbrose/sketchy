import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import './App.css';

// Use environment variable for API URL
const API_BASE_URL = process.env.REACT_APP_API_URL;

  console.log('API_BASE_URL:', API_BASE_URL);

// Anonymous per-browser id, persisted in a cookie, used to tell "an image I
// made" apart from everyone else's in the shared gallery - no accounts, so
// this is the only notion of identity the app has. It only works for images
// generated after this shipped (the server has to have stored a creatorId
// for it to be checked against), which is an accepted trade-off rather than
// a bug: nothing before this feature existed carries an owner.
const CREATOR_ID_COOKIE = 'sketchy_creator_id';
const CREATOR_ID_COOKIE_MAX_AGE_DAYS = 730; // ~2 years

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value, maxAgeDays) {
  const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function getOrCreateCreatorId() {
  let id = getCookie(CREATOR_ID_COOKIE);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setCookie(CREATOR_ID_COOKIE, id, CREATOR_ID_COOKIE_MAX_AGE_DAYS);
  }
  return id;
}

// Computed once at module load, not per-render - it never changes for the
// life of the tab (or until the cookie expires/is cleared).
const creatorId = getOrCreateCreatorId();

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

// A trash can, for the delete button shown only on images this browser made.
const DeleteIcon = () => (
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
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
  </svg>
);

// Breathing "..." down to no dot and back, so a long wait still reads as
// active rather than stuck, without claiming to know real backend progress.
const DOT_PATTERN = ['...', '..', '.', '', '.', '..'];
const AnimatedDots = () => {
  const [dots, setDots] = useState(DOT_PATTERN[0]);
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % DOT_PATTERN.length;
      setDots(DOT_PATTERN[i]);
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return <span aria-hidden="true">{dots}</span>;
};

function App() {
  const [prompt, setPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [createdAt, setCreatedAt] = useState(null);
  // Whether the image currently shown in the right panel was made by this
  // browser (see the creatorId cookie above) - gates the delete button.
  const [isOwnImage, setIsOwnImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
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
      // creatorId lets the server tell us which items (if any) are ours,
      // via isOwner on each item - it never sends back anyone's raw id.
      const response = await axios.get(`${API_BASE_URL}/gallery`, { params: { creatorId } });
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

      // Always show newest first, regardless of the order the server sent
      // them in.
      galleryItems = [...galleryItems].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

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
      setIsOwnImage(!!match.isOwner);
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
    setIsOwnImage(false);

    setStatusMessage('Generating inspiration');

    // The server streams progress as newline-delimited JSON, so each status
    // below reflects a real backend transition rather than a guessed delay -
    // ending with either a "done" event carrying the result, or an "error"
    // event carrying a message to show as-is.
    const STATUS_TEXT = {
      'creating-image': 'Creating image',
      'creating-thumbnail': 'Creating thumbnail',
    };

    try {
      const res = await fetch(`${API_BASE_URL}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, creatorId }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = null;
      let serverError = null;
      let creatingThumbnailAt = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          const event = JSON.parse(line);
          if (event.status === 'done') {
            result = event.result;
          } else if (event.status === 'error') {
            serverError = event.error;
          } else if (STATUS_TEXT[event.status]) {
            setStatusMessage(STATUS_TEXT[event.status]);
            if (event.status === 'creating-thumbnail') {
              creatingThumbnailAt = Date.now();
            }
          }
        }
      }

      // "Creating thumbnail" is the last message before done/error, and it's
      // normally a fast step - hold it on screen for a minimum stretch so it
      // doesn't just flash past unread.
      if (creatingThumbnailAt) {
        const remaining = 2000 - (Date.now() - creatingThumbnailAt);
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
      }

      if (serverError) {
        // Use the server's own message (e.g. the friendly "Sorry, this image
        // can't be generated." for a blocked prompt).
        setError(serverError);
      } else if (result) {
        setImage(result.imageUrl);
        setGeneratedPrompt(result.generatedPrompt);
        setOriginalPrompt(result.originalPrompt);
        setCreatedAt(result.createdAt);
        setIsOwnImage(true); // just generated it ourselves
        fetchGallery();
      } else {
        setError('Failed to generate image. Please try again.');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Failed to generate image. Please try again.');
    } finally {
      setStatusMessage('');
      setLoading(false);
    }
  };

  const handleGalleryItemClick = (item) => {
    setPrompt(item.prompt || ''); // Ensure it's never undefined
    setGeneratedPrompt(item.generatedPrompt || '');
    setOriginalPrompt(item.originalPrompt || '');
    setImage(item.imageUrl || null);
    setCreatedAt(item.createdAt || null);
    setIsOwnImage(!!item.isOwner);
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

  // Section header for a gallery date group: "Today"/"Yesterday" when
  // applicable, otherwise a full date (year only shown if not this year).
  const formatDateHeader = (isoString) => {
    const date = isoString ? new Date(isoString) : null;
    if (!date || isNaN(date.getTime())) return 'Unknown date';
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(new Date());
    const diffDays = Math.round((today - startOfDay(date)) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  // `gallery` is already sorted newest-first (see fetchGallery), so a single
  // pass grouping consecutive same-day items keeps both the section order
  // and the item order within each section correct. Anything older than 6
  // months collapses into one trailing "Older" section instead of a
  // day-by-day breakdown, so a gallery with a long history doesn't turn
  // into an endless list of one-off date headers.
  const galleryByDate = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const groups = [];
    let currentDayKey = null;
    gallery.forEach((item) => {
      const date = item.createdAt ? new Date(item.createdAt) : null;
      const isOld = date && !isNaN(date.getTime()) && date < sixMonthsAgo;
      const dayKey = isOld
        ? 'older'
        : (date && !isNaN(date.getTime()) ? date.toDateString() : 'unknown');
      if (dayKey !== currentDayKey || !groups.length) {
        const label = isOld ? 'Older' : formatDateHeader(item.createdAt);
        groups.push({ dayKey, label, items: [] });
        currentDayKey = dayKey;
      }
      groups[groups.length - 1].items.push(item);
    });
    return groups;
  }, [gallery]);

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

  const handleDeleteImage = async () => {
    if (!image || !isOwnImage) return;
    if (!window.confirm('Delete this image? This cannot be undone.')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/my-image`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: image, creatorId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete image');
      }

      setImage(null);
      setGeneratedPrompt('');
      setOriginalPrompt('');
      setCreatedAt(null);
      setIsOwnImage(false);
      fetchGallery();
      setToast('Image deleted');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Error deleting image:', err);
      setToast(err.message || 'Failed to delete image. Please try again.');
      setTimeout(() => setToast(null), 3000);
    }
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
            {galleryByDate.map((group, groupIndex) => (
              <div key={`${group.dayKey}-${groupIndex}`} className="gallery-date-group">
                <h4 className="gallery-date-header">{group.label}</h4>
                <div className="gallery-date-items">
                  {group.items.map((item, index) => (
                    <div key={item.imageUrl || index} className="gallery-item" onClick={() => handleGalleryItemClick(item)}>
                      <img
                        src={cachedImages[item.thumbnailUrl] ? cachedImages[item.thumbnailUrl].src : (item.thumbnailUrl || item.imageUrl)}
                        alt={item.originalPrompt || ''}
                      />
                      <p>{item.originalPrompt || ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel right-panel">
          {loading && <p>{statusMessage}<AnimatedDots /></p>}
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
              <div className="image-actions">
                {isOwnImage && (
                  <button className="delete-button" onClick={handleDeleteImage} title="Delete this image" aria-label="Delete this image">
                    <DeleteIcon /> Delete
                  </button>
                )}
                <button className="share-button" onClick={handleShare}>
                  <ShareIcon /> Share
                </button>
              </div>
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
