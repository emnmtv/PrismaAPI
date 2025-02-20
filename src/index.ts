import express from 'express';
import { authRouter } from './routes/authRoutes';
import cors from "cors";
import path from 'path';

import http from 'http';
import { Server } from 'socket.io';
const app = express();
const PORT = Number(process.env.PORT) || 3200;  // Ensuring it's a number

// Enable CORS
app.use(
  cors({
    origin: "*", // Allow requests from any origin
    methods: "GET,POST,PUT,DELETE", // Allowed HTTP methods
    allowedHeaders: "Content-Type,Authorization", // Allowed headers
    credentials: true, // Allow cookies and authorization headers
  })
);

// Increase the body parser size limit to handle large payloads (e.g., 10MB)
app.use(express.json({ limit: '300mb' })); // JSON payloads (increase to 10MB or more if needed)
app.use(express.urlencoded({ limit: '300mb', extended: true })); // URL-encoded payloads (if applicable)
// Serve static files from the "uploads" folder
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.use(express.json());
app.use('/auth', authRouter);

console.log("Serving static files from:", path.join(__dirname, '../uploads'));

const server = http.createServer(app);
const io = new Server(server);

// Handle socket connections
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('sendMessage', (data) => {
    io.to(data.receiverId).emit('receiveMessage', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
