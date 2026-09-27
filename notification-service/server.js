const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// Serving file static index.html
app.use(express.static('.'));

// ==========================================
// KONEKSI MONGODB ATLAS CLOUD
// ==========================================
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Notification Service (User 4): Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ Gagal koneksi MongoDB di Notification Service:', err));

// ==========================================
// SCHEMA & MODEL NOTIFIKASI
// ==========================================
const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'info' }, // 'info', 'success', 'warning', 'danger'
    timestamp: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

// ==========================================
// SOCKET.IO SERVER SETUP
// ==========================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Event saat ada device (client) yang terhubung ke server
io.on('connection', async (socket) => {
    console.log(`[+] Client terhubung dengan ID: ${socket.id}`);

    // Kirimkan 10 notifikasi terbaru saat client pertama kali terhubung
    try {
        const recentNotifications = await Notification.find()
            .sort({ timestamp: -1 })
            .limit(10);
        socket.emit('initial_notifications', recentNotifications);
    } catch (err) {
        console.error("Gagal mengambil initial notifications:", err);
    }

    socket.on('disconnect', () => {
        console.log(`[-] Client terputus: ${socket.id}`);
    });
});

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Endpoint Kirim Notifikasi (Simpan ke MongoDB & Broadcast Real-Time)
app.post('/api/notify', async (req, res) => {
    try {
        const { title, message, type } = req.body;

        if (!title || !message) {
            return res.status(400).json({ success: false, error: 'Title dan Message wajib diisi!' });
        }

        // A. SIMPAN KE MONGODB ATLAS
        const newNotif = new Notification({
            title: title,
            message: message,
            type: type || 'info'
        });
        await newNotif.save();

        // B. BROADCAST REAL-TIME VIA SOCKET.IO TO ALL CLIENTS
        io.emit('new_notification', {
            id: newNotif._id,
            title: newNotif.title,
            message: newNotif.message,
            type: newNotif.type,
            timestamp: newNotif.timestamp.toLocaleTimeString('id-ID')
        });

        console.log(`[BROADCAST & SAVED] ${title} - ${message}`);
        return res.status(201).json({ 
            success: true, 
            message: 'Notifikasi berhasil di-broadcast dan disimpan ke MongoDB!',
            data: newNotif
        });

    } catch (error) {
        console.error("❌ Gagal memproses notifikasi:", error);
        return res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server.' });
    }
});

// 2. Endpoint Ambil Riwayat Semua Notifikasi dari MongoDB
app.get('/api/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find()
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Gagal mengambil data notifikasi.' });
    }
});

// Jalankan di port 3004 dan izinkan akses dari IP lokal (0.0.0.0)
const PORT = process.env.PORT || 3004;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(` Notification Service (User 4) Running!`);
    console.log(`Port: ${PORT}`);
    console.log(`Akses Lokal : http://localhost:${PORT}`);
    console.log(`=================================`);
});