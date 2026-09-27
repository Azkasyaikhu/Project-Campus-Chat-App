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

const JWT_SECRET = 'kunci_rahasia_campus_chat_2026';

// [UI/UX] Menampilkan Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// [DATABASE] MONGODB ATLAS
// ==========================================
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ [DATABASE] Group Chat Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ [DATABASE] Error:', err));

// SCHEMA MONGODB
const groupMessageSchema = new mongoose.Schema({
    room: { type: String, required: true },
    sender: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});
const Room = mongoose.model('Room', roomSchema);

// ==========================================
// [API] KELOLA RUANG KELAS PERMANEN
// ==========================================
app.get('/api/rooms', async (req, res) => {
    try {
        // Ambil data room dari DB, default tambahkan 3 kelas awal jika DB kosong
        let rooms = await Room.find().sort({ createdAt: 1 });
        if(rooms.length === 0) {
            const defaultRooms = [{name: 'Sistem Terdistribusi'}, {name: 'Jaringan Komputer'}, {name: 'Pemrograman Web'}];
            await Room.insertMany(defaultRooms);
            rooms = await Room.find().sort({ createdAt: 1 });
        }
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil kelas' });
    }
});

app.post('/api/rooms', async (req, res) => {
    try {
        const { roomName } = req.body;
        const newRoom = new Room({ name: roomName });
        await newRoom.save();
        res.status(201).json(newRoom);
    } catch (err) {
        res.status(400).json({ error: 'Kelas sudah ada!' });
    }
});

// ==========================================
// [SOCKET.IO] CHAT REAL-TIME
// ==========================================
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// Middleware Socket Autentikasi JWT
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Token tidak valid"));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Token kadaluarsa"));
        socket.username = decoded.username; 
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`[LOG] ⚡ User sah terkoneksi | Socket: ${socket.id} | User: ${socket.username}`);

    socket.on('join_room', async (roomName) => {
        socket.join(roomName);
        console.log(`[LOG] 🚪 ${socket.username} bergabung ke ruang: ${roomName}`);
        
        try {
            // Tarik Riwayat Chat dari DB
            const history = await GroupMessage.find({ room: roomName }).sort({ timestamp: 1 }).limit(100);
            socket.emit('load_group_history', history);
        } catch (err) {
            console.error(err);
        }
        socket.to(roomName).emit('system_notification', `${socket.username} bergabung ke kelas.`);
    });

    socket.on('send_group_message', async (data) => {
        try {
            // Simpan Chat ke DB
            const newMsg = new GroupMessage({ room: data.room, sender: socket.username, message: data.message });
            await newMsg.save();

            // Broadcast ke orang lain
            socket.to(data.room).emit('receive_group_message', {
                room: data.room, sender: socket.username, message: data.message
            });
        } catch (err) {
            console.error(err);
        }
    });

    socket.on('disconnect', () => console.log(`[LOG] 🔴 ${socket.username} terputus.`));
});

const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`✅ Layanan Group Chat berjalan di http://localhost:${PORT}`);
    console.log(`===========================================`);
});