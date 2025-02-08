import express from 'express';
import { authRouter } from './routes/authRoutes';
import cors from "cors";
const app = express();
const PORT = process.env.PORT || 3200;

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});