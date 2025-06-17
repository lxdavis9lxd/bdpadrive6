const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'"]
    }
  }
}));

// Performance middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache static files for 1 day
  etag: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'bdpadrive-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const authRoutes = require('./routes/auth');
const explorerRoutes = require('./routes/explorer');
const editorRoutes = require('./routes/editor');
const dashboardRoutes = require('./routes/dashboard');

app.use('/auth', authLimiter, authRoutes);
app.use('/explorer', explorerRoutes);
app.use('/editor', editorRoutes);
app.use('/dashboard', dashboardRoutes);

// Root route - redirect to auth for guests, explorer for authenticated users
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/explorer');
  } else {
    res.redirect('/auth/login');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    user: req.session.user || null,
    error: null
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Don't expose stack traces in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).render('error', { 
    title: 'Server Error',
    message: isDevelopment ? err.message : 'Something went wrong on our end.',
    user: req.session.user || null,
    error: isDevelopment ? err.stack : null
  });
});

app.listen(PORT, () => {
  console.log(`BDPADrive server running on port ${PORT}`);
});
