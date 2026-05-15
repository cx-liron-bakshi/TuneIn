const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
require('./config/passport');

const rootRoute = require('./routes/rootRoute');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomBrowserRoutes');
const searchSongRoute = require('./routes/insideRoom/searchSongRoute');
const queueRoutes = require('./routes/insideRoom/queueRoutes');
const currentSongRoutes = require('./routes/insideRoom/CurrentSongRoute');
const chatRoutes = require('./routes/insideRoom/ChatRoute');
const liveViewersRoutes = require('./routes/insideRoom/LiveViewersRoutes');
const SocketHandler = require('./controllers/insideRoomControllers/VotingSystem/SocketHandler');


const app = express();

// Security headers
app.use(helmet());

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// Dynamic CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'https://tuneinapp.me',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// Session and Passport middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/youtube', searchSongRoute);
app.use('/api/queue', queueRoutes);
app.use('/api/song', currentSongRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/live-viewers', liveViewersRoutes);

app.get('/api/server-info', (req, res) => {
  res.json({
    apiUrl: req.protocol + '://' + req.get('host'),
    socketUrl: req.protocol + '://' + req.get('host'),
    timestamp: Date.now()
  });
});

// Root route - must be last to not interfere with API routes
app.use('/', rootRoute);

const server = http.createServer(app);

// Setup Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: ['https://tuneinapp.me', process.env.FRONTEND_URL || 'http://localhost:3000'],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Make io accessible to other files
app.set('socketio', io);


// SOCKET HANDLER FOR VOTING VIEWERS SYSTEM
SocketHandler.setupSocketHandlers(io);


mongoose.connect(process.env.MONGO_URI)
  .then(() => server.listen(5000, '0.0.0.0', () => console.log('Server running on port 5000'))) 
  .catch(err => console.error(err));

// to future add: initalize playback service.