# Sketchy

React app to make an image from a song or artist.

Uses OpenAI API to generate a specific prompt that is tailored to music and then creates the image from that prompt.

## Setup Instructions

To try Sketchy:

1. Clone the repository:
   ```
   git clone https://github.com/bobbrose/sketchy.git
   cd sketchy
   ```

2. Install dependencies:
   ```
   npm run install-all
   ```

3. Create a `.env` file in the server directory and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_openai_api_key
   ```

4. By default, it will use a mock API to save on server calls. To use the real OpenAI API, add this to your `.env` file:
   ```
   USE_OPENAI_API=true
   ```

5. Start the backend server in the 'server' directory:
   ```
   npm run server
   ```

6. In a new terminal, start the React development server in the 'client' directory:
   ```
   npm run client
   ```

7. Open your browser and navigate to http://localhost:3000 to view the app.
## Project Structure

- `client/`: Contains the React frontend application
- `server/`: Contains the Node.js backend server
- `package.json`: Root-level package for running both client and server

## Technologies Used

- Frontend: React
- Backend: Node.js with Express
- API: OpenAI for prompt generation and image creation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
## Credits

This project was developed with the assistance of [Augment Code](https://www.augmentcode.com/), an AI-powered coding assistant.