const express = require('express');
const path = require('path');
const ticketRoutes = require('./routes/tickets');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const { auth } = require('express-openid-connect');

const config = {
  authRequired: false, 
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: 'https://dev-t1lg5mupekaecrjv.us.auth0.com'
  
};

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

const authenticate = async (req, res, next) => {
  try {
    const response = await axios.post(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      audience: process.env.AUDIENCE,
      grant_type: 'client_credentials'
    });

    req.token = response.data.access_token;
    next();
  } catch (error) {
    console.error('Greška pri dobivanju access tokena:', error);
    res.status(500).json({ error: 'Greška pri dobivanju tokena' });
  }
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(auth(config));

app.get('/api/user', (req, res) => {
  if (req.oidc.user) {
    res.json(req.oidc.user);
  } else {
    res.status(401).json({ message: 'Niste prijavljeni.' });
  }
});

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM tickets');
    const ticketCount = result.rows[0].count;
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  } catch (error) {
    console.error(error);
    res.status(500).send('Greška na serveru');
  }
});

app.use('/api/tickets', authenticate, ticketRoutes);

app.get('/ticket/:id', auth(), async (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'ticket.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));