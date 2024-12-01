Sketchy - React app to make an image from a song or artist.

Uses OpenAI API to generate a specific prompt that is tailored to music and then creates the image from that prompt.

Used AugmentCode as coding assistant to write most of the code for the server and client.

## Setup Instructions

To try sketchy:

git clone https://github.com/bobbrose/sketchy.git
cd sketchy  
npm install express axios cors dotenv openai uuid

Create a `.env` file in the server directory and add your OpenAI API key:
OPENAI_API_KEY=your_actual_openai_api_key
It will use a mock API to save on server calls unless you also put this in:
USE_OPENAI_API=true 

Start the backend server in the 'server' directory:
node server.js

Start the react server in the 'client' directory:
npm start

Open your browser and navigate to http://localhost:3000 to view the app.


