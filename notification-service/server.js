const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const JWT_SECRET = process.env.JWT_SECRET || 'kunci_rahasia_campus_chat_2026';
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// KONEKSI MONGODB ATLAS CLOUD
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Notification Service (Node #4): Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ Gagal koneksi MongoDB di Notification Service:', err));

const notificationSchema = new mongoose.Schema({
    targetUser: { type: String, default: null }, // null = Global, String = Khusus user tertentu
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'info' }, 
    timestamp: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema, 'notifications');

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware Autentikasi JWT Socket
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Token tidak valid"));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Token kadaluarsa"));
        socket.username = decoded.username; 
        next();
    });
});

io.on('connection', async (socket) => {
    const username = socket.username;
    
    // Client masuk ke Room khusus sesuai Username
    socket.join(username);
    console.log(`[+] Client terhubung: @${username} (ID: ${socket.id}) -> Masuk Room "${username}"`);

    try {
        // Ambil riwayat notifikasi KHUSUS user ini ATAU notifikasi Global
        const recentNotifications = await Notification.find({
            $or: [
                { targetUser: username },
                { targetUser: null },
                { targetUser: { $exists: false } }
            ]
        })
        .sort({ timestamp: -1 })
        .limit(10);

        socket.emit('initial_notifications', recentNotifications);
    } catch (err) {
        console.error("Gagal mengambil initial notifications:", err);
    }

    socket.on('disconnect', () => {
        console.log(`[-] Client terputus: @${username}`);
    });
});

// ==========================================
// REST API ENDPOINTS
// ==========================================

app.post('/api/notify', async (req, res) => {
    try {
        const { targetUser, title, message, type } = req.body;

        if (!title || !title.trim() || !message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Title dan Message wajib diisi!' });
        }

        const newNotif = new Notification({
            targetUser: targetUser || null,
            title: title.trim(),
            message: message.trim(),
            type: type || 'info'
        });
        await newNotif.save();

        const payload = {
            id: newNotif._id,
            targetUser: newNotif.targetUser,
            title: newNotif.title,
            message: newNotif.message,
            type: newNotif.type,
            timestamp: newNotif.timestamp
        };

        // Jika ada targetUser -> Kirim hanya ke room user tersebut
        if (targetUser) {
            io.to(targetUser).emit('new_notification', payload);
            console.log(`[TARGETED NOTIF] Dikirim khusus ke @${targetUser}: ${newNotif.title}`);
        } else {
            // Jika tidak ada -> Broadcast Global
            io.emit('new_notification', payload);
            console.log(`[GLOBAL BROADCAST] ${newNotif.title}`);
        }

        return res.status(201).json({ success: true, message: 'Notifikasi berhasil diproses!' });
    } catch (error) {
        console.error('Error /api/notify:', error);
        return res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server.' });
    }
});

app.get('/api/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ timestamp: -1 }).limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Gagal mengambil data notifikasi.' });
    }
});

const PORT = process.env.PORT || 3004;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 Notification Service (Node #4) Running!`);
    console.log(`Port: ${PORT}`);
    console.log(`=================================`);
});