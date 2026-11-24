// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Import our database pool
const pool = require('./config/db');
const verifyToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); 

// Health Check Route
app.get('/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.status(200).json({ 
      status: 'OK', 
      dbTime: dbRes.rows[0].now,
      message: 'Server and Database are healthy.' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'ERROR', message: 'Database connection failed.' });
  }
});
app.post('/api/login', (req, res) => {
  // Mock user payload to bypass the DB for now
  const user = { id: 1, email: "intern@test.com" }; 
  
  // Generate a token valid for 1 hour
  const token = jwt.sign(user, process.env.JWT_SECRET || 'my_super_secret_key', { expiresIn: '30d' });
  
  res.status(200).json({ token });
});

// Register New User
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check if the user already exists in the database
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ status: 'ERROR', message: 'User already exists.' });
    }

    // 2. Hash the password for security
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Insert the new user into the PostgreSQL database
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );

    // 4. Generate a JWT token for the user
    const token = jwt.sign(
      { userId: newUser.rows[0].id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.status(201).json({ 
      status: 'OK', 
      message: 'User registered successfully!',
      token: token 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'ERROR', message: 'Server error during registration.' });
  }
});
// Login User
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user in the database
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ status: 'ERROR', message: 'Invalid email or password.' });
    }
    
    const user = userResult.rows[0];

    // 2. Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'ERROR', message: 'Invalid email or password.' });
    }

    // 3. Generate a new JWT token for the session
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.status(200).json({ 
      status: 'OK', 
      message: 'Login successful!',
      token: token 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'ERROR', message: 'Server error during login.' });
  }
});
// Save Watch History (Protected Route)
app.post('/history', verifyToken, async (req, res) => {
  try {
    // req.user.userId comes directly from your decoded JWT!
    const userId = req.user.userId; 
    const { videoId, progressSeconds } = req.body;

    // Insert or update the user's watch progress in PostgreSQL
    await pool.query(
      `INSERT INTO watch_history (user_id, video_id, progress_seconds) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id, video_id) 
       DO UPDATE SET progress_seconds = EXCLUDED.progress_seconds, last_watched = CURRENT_TIMESTAMP`,
      [userId, videoId, progressSeconds]
    );

    res.status(200).json({ status: 'OK', message: 'Watch progress saved successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to save progress.' });
  }
});
// Get User Watch History
app.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Fetch all history for this user, sorted by most recently watched
    const history = await pool.query(
      'SELECT video_id, progress_seconds, last_watched FROM watch_history WHERE user_id = $1 ORDER BY last_watched DESC',
      [userId]
    );

    res.status(200).json({ status: 'OK', data: history.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'ERROR', message: 'Failed to fetch history.' });
  }
});
app.post('/api/add-favorite', verifyToken, async (req, res) => {
  try {
    // 1. Grab the movie details sent from your React frontend
    const { movieId, movieTitle, posterPath } = req.body;
    
    // 2. Grab the logged-in user's ID from the JWT token
    const userId = req.user.id; 

    // 3. Save to the database using the correct SQL syntax
    const newFavorite = await pool.query(
      "INSERT INTO favorites (user_id, movie_id, movie_title, poster_path) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, movieId, movieTitle, posterPath]
    );

    res.status(200).json(newFavorite.rows[0]);
  } catch (err) {
    console.error("=== CRASH DETAILS ===", err);
    if (err.code === '23505') {
      return res.status(400).json({ error: "Movie already in your list" });
    }
    res.status(500).json({ error: "Server error" });
  }
});
// Start the Server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Silent heartbeat to keep the server awake
setInterval(() => {}, 60000);