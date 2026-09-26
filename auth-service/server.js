const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'kunci_rahasia_kelompok_kami';

// Middleware
app.use(express.static('.')); // Menyajikan file html secara gratis
app.use(cors()); // Mengizinkan akses dari IP laptop lain
app.use(express.json());

// Database Sementara (In-Memory Array) agar mudah dicoba pemula
const users = [];

// ==========================================
// ENDPOINT REST API
// ==========================================

// 1. Endpoint Pendaftaran (Register)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username dan password wajib diisi!' });
        }

        // Cek apakah user sudah ada
        const existingUser = users.find(u => u.username === username);
        if (existingUser) {
            return res.status(400).json({ message: 'Username sudah digunakan!' });
        }

        // Enkripsi password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = { id: users.length + 1, username, password: hashedPassword };
        users.push(newUser);

        res.status(201).json({ message: 'Register berhasil!', user: { id: newUser.id, username: newUser.username } });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
});

// 2. Endpoint Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(400).json({ message: 'Username atau password salah!' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Username atau password salah!' });
        }

        // Buat JWT Token
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

        res.json({
            message: 'Login berhasil!',
            token: token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
});

// 3. Endpoint Verifikasi Token (Untuk dipanggil oleh User 2, 3, dan 4)
app.post('/api/verify-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ valid: false, message: 'Token tidak ada' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ valid: false, message: 'Token tidak valid' });
        res.json({ valid: true, user });
    });
});

// 4. Endpoint Ambil Semua User Terdaftar
app.get('/api/users', (req, res) => {
    const userList = users.map(u => ({ id: u.id, username: u.username }));
    res.json(userList);
});

// Jalankan Server pada Port 3001
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`Auth Service (User 1) Running!`);
    console.log(`Port: ${PORT}`);
    console.log(`Akses Lokal : http://localhost:${PORT}`);
    console.log(`=================================`);
});