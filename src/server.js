import express from 'express';
import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoute from './routes/auth.js'; 
import { authenticateJWT, isAdmin } from './middleware/authMiddleware.js';
import trackingRoute from './routes/tracking.js';
import serviceRoutes from './routes/serviceRoutes.js';
import walletRoute from './routes/rechargeWallet.js'; 
import userProfileRoutes from './routes/userProfile.js'; 
import adminRoute from './routes/admin.js';

import './intervals/deviceConnectionCheck.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const KEY = process.env.KEY;
const CERT = process.env.CERT;

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoute); 

app.use('/api/track', trackingRoute);

app.use('/api', authenticateJWT, serviceRoutes);

app.use('/api/wallet', authenticateJWT, walletRoute); 

app.use('/api/user', authenticateJWT, userProfileRoutes);

app.use('/api/admin', authenticateJWT, isAdmin, adminRoute);


// Serve frontend static files
app.use(express.static(path.join(__dirname, '/dist')));

// Fallback for React routing
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '/dist', 'index.html'));
});



// HTTPS configuration
const sslOptions = {
  key: fs.readFileSync(KEY),
  cert: fs.readFileSync(CERT),
};

// Start server
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`🚀 Server running at https://213.233.184.211:${PORT}`);
});
