const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // [DITAMBAHKAN] Untuk verifikasi SSO

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const JWT_SECRET = 'kunci_rahasia_campus_chat_2026';

// ==========================================
// KONEKSI MONGODB ATLAS CLOUD
// ==========================================
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Notification Service (User 4): Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ Gagal koneksi MongoDB di Notification Service:', err));

const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'info' }, 
    timestamp: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// [DITAMBAHKAN] Middleware Autentikasi JWT
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
    // Log sekarang menampilkan nama user yang valid
    console.log(`[+] Client terhubung: ${socket.username} (ID: ${socket.id})`);

    try {
        const recentNotifications = await Notification.find()
            .sort({ timestamp: -1 })
            .limit(10);
        socket.emit('initial_notifications', recentNotifications);
    } catch (err) {
        console.error("Gagal mengambil initial notifications:", err);
    }

    socket.on('disconnect', () => {
        console.log(`[-] Client terputus: ${socket.username}`);
    });
});

// Endpoint untuk menerima "Trigger" Notifikasi dari Node Lain
app.post('/api/notify', async (req, res) => {
    try {
        const { title, message, type } = req.body;
        if (!title || !message) return res.status(400).json({ success: false, error: 'Title dan Message wajib diisi!' });

        const newNotif = new Notification({ title, message, type: type || 'info' });
        await newNotif.save();

        io.emit('new_notification', {
            id: newNotif._id,
            title: newNotif.title,
            message: newNotif.message,
            type: newNotif.type,
            timestamp: newNotif.timestamp.toLocaleTimeString('id-ID')
        });

        console.log(`[BROADCAST] ${title} - ${message}`);
        return res.status(201).json({ success: true, message: 'Notifikasi di-broadcast!' });
    } catch (error) {
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
    console.log(`🚀 Notification Service (User 4) Running!`);
    console.log(`Port: ${PORT}`);
    console.log(`=================================`);
});