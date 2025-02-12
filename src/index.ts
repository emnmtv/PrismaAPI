import express from 'express';
import { authRouter } from './routes/authRoutes';
import cors from "cors";
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



app.use(express.json());
app.use('/auth', authRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT} and http://192.168.0.104:${PORT}`);
});
