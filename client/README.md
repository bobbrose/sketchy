Sketchy - React app to make iterate on image generate

Currently uses OpenAI image generateion, could be switchted to use any.

This project consists of two main components:
1. A React frontend
2. A Node.js backend server

## Setup Instructions

To try sketchy:

git clone https://github.com/bobbrose/sketchy.git
cd sketchy
npm install

 Create a `.env` file in the root directory and add your OpenAI API key:
 OPENAI_API_KEY=your_actual_openai_api_key_here

Add a boolean if you want to use mock images to avoid openAI charges:
USE_MOCK_API=true

start the backend server:
node server.js

In a new terminal, start the React development server:
npm start

Open your browser and navigate to http://localhost:3000 to view the app.


