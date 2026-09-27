const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // [BARU] Untuk validasi auth dari Port 3001

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'kunci_rahasia_campus_chat_2026'; // Harus sama persis dengan di Port 3001

// ==========================================
// [DATABASE] KONEKSI MONGODB ATLAS CLOUD
// ==========================================
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ [DATABASE] Group Chat Service Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ [DATABASE] Connection Error:', err));

// ==========================================
// [DATABASE] SCHEMA & MODELS
// ==========================================
// 1. Schema Pesan Chat
const groupMessageSchema = new mongoose.Schema({
    room: { type: String, required: true },
    sender: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

// 2. Schema Ruang Kelas (Agar permanen)
const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});
const Room = mongoose.model('Room', roomSchema);

// ==========================================
// [BACKEND] REST API
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Ambil Daftar Kelas
app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await Room.find().sort({ createdAt: -1 });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil data kelas' });
    }
});

// API Buat Kelas Baru
app.post('/api/rooms', async (req, res) => {
    try {
        const { roomName } = req.body;
        if (!roomName) return res.status(400).json({ error: 'Nama kelas wajib diisi' });

        const newRoom = new Room({ name: roomName });
        await newRoom.save();
        res.status(201).json(newRoom);
    } catch (err) {
        res.status(400).json({ error: 'Kelas sudah ada atau gagal dibuat' });
    }
});

// ==========================================
// [BACKEND] SOCKET.IO SERVER
// ==========================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware Socket.io untuk Verifikasi Token JWT
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Akses Ditolak: Token tidak ditemukan"));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Akses Ditolak: Token tidak valid/kadaluarsa"));
        socket.username = decoded.username; // Simpan username dari token ke sesi socket
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`[LOG] ⚡ User sah terkoneksi | Socket: ${socket.id} | User: ${socket.username}`);

    socket.on('join_room', async (roomName) => {
        socket.join(roomName);
        console.log(`[LOG] 🚪 ${socket.username} bergabung ke kelas: ${roomName}`);
        
        try {
            // Tarik riwayat chat spesifik untuk kelas ini
            const history = await GroupMessage.find({ room: roomName })
                .sort({ timestamp: 1 })
                .limit(100);
            socket.emit('load_group_history', history);
        } catch (err) {
            console.error('[ERROR] Gagal memuat history:', err);
        }

        socket.to(roomName).emit('system_notification', `${socket.username} bergabung ke kelas.`);
    });

    socket.on('send_group_message', async (data) => {
        try {
            const newGroupMsg = new GroupMessage({
                room: data.room,
                sender: socket.username, // Otomatis dari token, anti-spoofing
                message: data.message
            });
            await newGroupMsg.save();

            // Broadcast ke semua anggota kelas
            io.to(data.room).emit('receive_group_message', {
                room: data.room,
                sender: socket.username,
                message: data.message,
                timestamp: newGroupMsg.timestamp
            });
        } catch (err) {
            console.error('[ERROR] Gagal menyimpan pesan:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[LOG] 🔴 ${socket.username} terputus.`);
    });
});

const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`🌐 Group Chat Node (User 3) Running on Port ${PORT}`);
    console.log(`===========================================`);
});