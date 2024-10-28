const express = require('express');
const path = require('path');
const ticketRoutes = require('./routes/tickets');
const { auth } = require('express-openid-connect');
const { Pool } = require('pg');
require('dotenv').config();

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

const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET,
    baseURL: process.env.BASE_URL || 'https://web2-l1.onrender.com',
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
    authorizationParams: {
        response_type: 'code',
        scope: 'openid profile email',
        redirect_uri: 'https://web2-l1.onrender.com/callback'
    }
};

const app = express();
app.use(auth(config));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.use('/api', ticketRoutes);

app.get('/api/user', (req, res) => {
    if (req.oidc.isAuthenticated()) {
        res.json(req.oidc.user);
    } else {
        res.status(401).json({ error: 'Korisnik nije prijavljen.' });
    }
});

app.get('/callback', (req, res) => {
    res.redirect('/');
});

app.get('/login', (req, res) => {
    res.oidc.login();
});

app.get('/logout', (req, res) => {
    res.oidc.logout();
});

app.get('/ticket/:id', (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.status(401).send('Pristup zabranjen. Morate biti prijavljeni.');
    }
    res.sendFile(path.join(__dirname, 'views', 'ticket.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
