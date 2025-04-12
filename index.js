// Step 1: Import required modules
import express from 'express';
import http from 'http';

// Step 3: Create basic Express app + HTTP server + Socket.IO layer
const app = express();
const server = http.createServer(app);
app.get('/', (_, res) => res.send('RTP stream is running'));


// Step 4: Start HTTP server
server.listen(3000, '0.0.0.0', () => {
	console.log('✅ Server running at http://0.0.0.0:3000');
});

