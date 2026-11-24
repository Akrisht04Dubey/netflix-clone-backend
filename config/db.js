// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool using variables from .env
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  
  max: 20, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000, 
});

pool.on('connect', () => {
  console.log('Successfully connected to the PostgreSQL database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  
});

module.exports = pool;