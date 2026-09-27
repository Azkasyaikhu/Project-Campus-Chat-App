const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'kunci_rahasia_campus_chat_2026';

// Middleware
app.use(express.static('.')); // Menyajikan file index.html di browser
app.use(cors());
app.use(express.json());

// ==========================================
// KONEKSI MONGODB ATLAS CLOUD
// ==========================================
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas Cloud Terhubung Berhasil!'))
    .catch(err => console.error('❌ Gagal Konek MongoDB:', err));

// Schema & Model User untuk MongoDB
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// ENDPOINT REST API
// ==========================================

// 1. Endpoint Register (Simpan ke MongoDB Atlas)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username dan password wajib diisi!' });
        }

        // Cek apakah user sudah ada di database
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username sudah digunakan!' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Simpan ke MongoDB Atlas
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        
        res.status(201).json({ 
            message: 'Register berhasil!', 
            user: { id: newUser._id, username: newUser.username } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
});

// 2. Endpoint Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Username atau password salah!' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Username atau password salah!' });
        }

        // Buat JWT Token
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });

        res.json({
            message: 'Login berhasil!',
            token: token,
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
});

// 3. Endpoint Verifikasi Token (Untuk Service Lain)
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
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username _id');
        const userList = users.map(u => ({ id: u._id, username: u.username }));
        res.json(userList);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data user.' });
    }
});

// Jalankan Server pada Port 3001
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`Auth Service (User 1) Running!`);
    console.log(`Port: ${PORT}`);
    console.log(`Akses Lokal : http://localhost:${PORT}`);
    console.log(`=================================`);
});