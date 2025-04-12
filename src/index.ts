import express from 'express';
import { authRouter } from './routes/authRoutes';
import cors from "cors";
import path from 'path';

import http from 'http';
import { Server } from 'socket.io';
import './utils/paymentCleanup'; // Import the payment cleanup job
import './utils/paymentStatusChecker'; // Import the payment status checker
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

// Log the absolute path of the uploads directory
const uploadsPath = path.join(__dirname, '../uploads');
console.log('Uploads directory absolute path:', uploadsPath);

// Serve static files from the uploads directory
app.use('/uploads', express.static(uploadsPath));

app.use(express.json());
app.use('/auth', authRouter);

// Log the uploads directory path for debugging
console.log("Serving static files from:", path.join(__dirname, '../uploads'));

const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: "*", // Add your Vue app URLs
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinChat', (userId) => {
    if (!userId) {
      console.error('No userId provided for joinChat');
      return;
    }
    
    const roomId = userId.toString();
    socket.join(roomId);
    console.log(`User ${userId} joined their chat room ${roomId}`);
  });

  socket.on('sendMessage', (data) => {
    if (!data.receiverId || !data.senderId) {
      console.error('Missing receiverId or senderId in message data');
      return;
    }

    const receiverRoom = data.receiverId.toString();
    const senderRoom = data.senderId.toString();
    
    console.log(`Sending message to rooms: ${receiverRoom} and ${senderRoom}`);
    
    io.to(receiverRoom).emit('receiveMessage', data);
    io.to(senderRoom).emit('receiveMessage', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Server is accessible on the network at http://192.168.0.104:${PORT}`); // Added log for network access
});
