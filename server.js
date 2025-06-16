const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'bdpadrive-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const authRoutes = require('./routes/auth');
const explorerRoutes = require('./routes/explorer');
const editorRoutes = require('./routes/editor');
const dashboardRoutes = require('./routes/dashboard');
const searchRoutes = require('./routes/search');

app.use('/auth', authRoutes);
app.use('/explorer', explorerRoutes);
app.use('/editor', editorRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/search', searchRoutes);

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
    user: req.session.user || null
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Server Error',
    message: 'Something went wrong on our end.',
    user: req.session.user || null
  });
});

app.listen(PORT, () => {
  console.log(`BDPADrive server running on port ${PORT}`);
});
