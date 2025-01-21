# Sketchy

Create AI-generated artwork inspired by songs and musical artists. This app uses OpenAI's GPT and DALL-E to generate unique visual interpretations of music.

## Features

- Generate AI artwork from any song or artist name
- View gallery of previously generated images
- Share generated images via URL
- Responsive design that works on mobile and desktop
- Automatic image optimization and caching

## How It Works

1. Enter a song or artist name
2. GPT generates a detailed visual description based on the music
3. DALL-E creates artwork from that description
4. Image is optimized and stored for sharing

## Tech Stack

- **Frontend**: React
- **Backend**: Node.js + Express
- **AI**: OpenAI (GPT-3.5 + DALL-E 3)
- **Storage**: 
  - Images: Vercel Blob Storage
  - Metadata: Vercel KV (Redis)
- **Deployment**: Vercel

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/bobbrose/sketchy.git
   cd sketchy
   ```

2. Install dependencies:
   ```bash
   npm run install-all
   ```

3. Create `.env` files:

   In `/server/.env`:
   ```bash
   OPENAI_API_KEY=your_openai_api_key
   USE_OPENAI_API=true  # Set to false to use mock API
   ADMIN_API_KEY=your_admin_key  # For protected endpoints
   ```

   For production features (optional):
   ```bash
   BLOB_READ_WRITE_TOKEN=your_blob_token
   KV_REST_API_URL=your_kv_url
   KV_REST_API_TOKEN=your_kv_token
   ```

4. Start development servers:
   ```bash
   # Terminal 1 - Backend (http://localhost:3001)
   npm run server

   # Terminal 2 - Frontend (http://localhost:3000)
   npm run client
   ```

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API authentication | Yes |
| `USE_OPENAI_API` | Enable real API vs mock | No (defaults false) |
| `ADMIN_API_KEY` | Protect admin endpoints | Yes for admin features |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Storage access | Production only |
| `KV_REST_API_TOKEN` | Vercel KV access | Production only |

## API Endpoints

- `POST /api/generate-image` - Generate new artwork
- `GET /api/gallery` - Retrieve gallery images
- `DELETE /api/clear-gallery` - Admin: Clear gallery
- `DELETE /api/remove-image` - Admin: Remove specific image
- `POST /api/reduce-gallery` - Admin: Reduce gallery size


## License

This project is open source under the MIT License. See [LICENSE](LICENSE) for details.

## Credits

- Created by [Bob Rose](https://bobbrose.com)
- Developed with assistance from [Augment Code](https://www.augmentcode.com/)

## Support & Feedback

- For issues and feature requests, please [open an issue](https://github.com/bobbrose/sketchy/issues)
- Try it out and let me know what you think! 
- Share your favorite generated images on LinkedIn and tag [Bob Rose](https://www.linkedin.com/in/bobbrose/)
- Star ⭐ the repo if you found it interesting
