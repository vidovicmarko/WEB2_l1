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
