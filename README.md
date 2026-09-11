# Sketchy

Create AI-generated artwork inspired by songs and musical artists. This app uses OpenAI's GPT to write a detailed visual description of a song or artist, then an OpenAI image model to turn that description into artwork.

See [docs/vision.md](docs/vision.md) for why it's built this way (and how it differs from just asking a chatbot for "an image of a song"), and [docs/tech-spec.md](docs/tech-spec.md) for how it's built and how to maintain it.

## Features

- Generate AI artwork from any song or artist name
- View gallery of previously generated images
- Share generated images via a link back into the app (opens straight to that image)
- Responsive design that works on mobile and desktop
- Automatic image optimization and caching

## How It Works

1. Enter a song or artist name
2. GPT generates a detailed visual description based on the music
3. An OpenAI image model (`gpt-image-1`) creates artwork from that description
4. Image and a thumbnail are generated and stored for sharing

## Tech Stack

- **Frontend**: React
- **Backend**: Node.js + Express
- **AI**: OpenAI (GPT-3.5 + gpt-image-1)
- **Storage**:
  - Local dev: filesystem (`server/images/`) + in-memory gallery
  - Production: Vercel Blob Storage (images) + Vercel KV/Redis (metadata)
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
- Started with assistance from [Augment Code](https://www.augmentcode.com/), now developed with [Claude Code](https://claude.com/claude-code)

## Support & Feedback

- For issues and feature requests, please [open an issue](https://github.com/bobbrose/sketchy/issues)
- Try it out and let me know what you think! 
- Share your favorite generated images on LinkedIn and tag [Bob Rose](https://www.linkedin.com/in/bobbrose/)
- Star ⭐ the repo if you found it interesting
