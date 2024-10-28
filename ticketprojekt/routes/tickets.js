const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { auth } = require('express-openid-connect');

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

const requireAuth = (req, res, next) => {
    if (!req.oidc.isAuthenticated()) {
        return res.status(401).json({ error: 'Korisnik nije prijavljen.' });
    }
    next();
};

router.post('/tickets', requireAuth, async (req, res) => { 
    const { vatin, firstname, lastname } = req.body;

    if (!vatin || !firstname || !lastname) {
        return res.status(400).json({ error: 'Svi podaci su obavezni.' });
    }
    try {
        const result = await pool.query('SELECT COUNT(*) FROM tickets WHERE vatin = $1', [vatin]);

        if (parseInt(result.rows[0].count) >= 3) {
            return res.status(400).json({ error: 'Maksimalno 3 ulaznice po OIB-u su dozvoljene.' });
        }

        const id = uuidv4();
        const created_at = new Date();
        await pool.query(
            'INSERT INTO tickets (id, vatin, firstname, lastname, created_at) VALUES ($1, $2, $3, $4, $5)',
            [id, vatin, firstname, lastname, created_at]
        );

        const qrUrl = `${process.env.BASE_URL}/ticket/${id}`;
        const qrCode = await QRCode.toDataURL(qrUrl);

        res.status(201).json({ message: 'Ulaznica uspješno kreirana', ticketId: id, qrCode });
    } catch (error) {
        console.error('Greška pri kreiranju ulaznice:', error);
        res.status(500).json({ error: 'Greška na serveru' });
    }
});

router.get('/ticket/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).send('ID ulaznice nije naveden.');
    }
    try {
        const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Ulaznica nije pronađena.');
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).send('Greška na serveru');
    }
});

router.get('/tickets/count', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM tickets');
        res.status(200).json({ count: result.rows[0].count });
    } catch (error) {
        res.status(500).json({ error: 'Greška na serveru' });
    }
});

module.exports = router;
