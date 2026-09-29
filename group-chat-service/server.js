const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'kunci_rahasia_campus_chat_2026';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004/api/notify';

// Menyiapkan static file HTML
app.use(express.static('.'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ==========================================
// KONEKSI MONGODB ATLAS CLOUD (DATABASE: campus_chat)
// ==========================================
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas (Group Chat Node #3) Terhubung!'))
    .catch(err => console.error('❌ Gagal Konek MongoDB di Group Chat:', err));

// 1. Skema Room / Kelas (Menunjuk ke collection 'rooms')
const roomSchema = new mongoose.Schema({
    nama_room: { type: String, required: true, unique: true },
    pembuat: { type: String, required: true },
    waktu: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema, 'rooms');

// 2. Skema Pesan Grup (Menunjuk ke collection 'groupmessages')
const groupMessageSchema = new mongoose.Schema({
    room: { type: String, required: true },
    pengirim: { type: String, required: true },
    pesan: { type: String, required: true },
    waktu: { type: Date, default: Date.now }
});

const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema, 'groupmessages');

// ==========================================
// REST API ENDPOINTS (Membuat & Mengambil Kelas/Room)
// ==========================================

// Endpoint Ambil Daftar Kelas/Room
app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await Room.find().sort({ waktu: -1 });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Gagal mengambil daftar kelas.' });
    }
});

// Endpoint Buat Kelas/Room Baru via HTTP POST
app.post('/api/rooms', async (req, res) => {
    try {
        const { nama_room, name, nama_kelas, pembuat } = req.body;
        const roomName = (nama_room || name || nama_kelas || '').trim();
        const createdBy = (pembuat || 'Sistem').trim();

        if (!roomName) {
            return res.status(400).json({ success: false, error: 'Nama kelas/room tidak boleh kosong!' });
        }

        const existingRoom = await Room.findOne({ nama_room: roomName });
        if (existingRoom) {
            return res.status(400).json({ success: false, error: 'Kelas/Room sudah ada!' });
        }

        const newRoom = new Room({
            nama_room: roomName,
            pembuat: createdBy
        });
        await newRoom.save();

        // Broadcast ke semua client socket
        io.emit('room_created', newRoom);

        // Pemicu Notifikasi ke Node #4
        axios.post(NOTIFICATION_SERVICE_URL, {
            title: `[Grup Baru] ${roomName}`,
            message: `Kelas/Room "${roomName}" telah dibuat oleh @${createdBy}`,
            type: 'success'
        }).catch(err => console.error('⚠️ Gagal kirim notif ke Node #4:', err.message));

        res.status(201).json({ success: true, data: newRoom });
    } catch (error) {
        console.error('Error create room API:', error);
        res.status(500).json({ success: false, error: 'Gagal membuat kelas/room.' });
    }
});

// ==========================================
// SOCKET.IO REALTIME HANDLER
// ==========================================

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
    const namaUser = socket.username;
    console.log(`🔌 [LOG] ${namaUser} terhubung ke Group Chat Service | Socket ID: ${socket.id}`);

    // Event 1: Request Daftar Room via Socket
    socket.on('get_rooms', async () => {
        try {
            const rooms = await Room.find().sort({ waktu: -1 });
            socket.emit('load_rooms', rooms);
        } catch (error) {
            console.error('Gagal mengambil daftar room via socket:', error);
        }
    });

    // Event 2: Buat Room/Kelas Baru via Socket
    socket.on('create_room', async (data) => {
        const roomName = typeof data === 'string' ? data.trim() : (data.nama_room || data.name || data.nama_kelas || '').trim();

        if (!roomName) {
            return socket.emit('error_message', 'Nama room/kelas tidak boleh kosong.');
        }

        try {
            const existingRoom = await Room.findOne({ nama_room: roomName });
            if (existingRoom) {
                return socket.emit('error_message', `Kelas/Room "${roomName}" sudah ada.`);
            }

            const newRoom = new Room({
                nama_room: roomName,
                pembuat: namaUser
            });
            await newRoom.save();

            // Broadcast ke seluruh client
            io.emit('room_created', newRoom);

            // Trigger notifikasi ke Node #4
            axios.post(NOTIFICATION_SERVICE_URL, {
                title: `[Grup Baru] ${roomName}`,
                message: `Kelas/Room "${roomName}" telah dibuat oleh @${namaUser}`,
                type: 'success'
            }).catch(err => console.error('⚠️ Gagal kirim notif ke Node #4:', err.message));

            console.log(`✨ Room/Kelas baru dibuat: "${roomName}" oleh @${namaUser}`);
        } catch (error) {
            console.error('Gagal membuat room via socket:', error);
            socket.emit('error_message', 'Gagal membuat kelas/room.');
        }
    });

    // Event 3: Bergabung ke Room
    socket.on('join_room', async (room) => {
        if (!room) return;
        socket.join(room);
        console.log(`📌 User @${namaUser} bergabung ke room/grup: "${room}"`);

        try {
            const history = await GroupMessage.find({ room: room }).sort({ waktu: 1 });
            socket.emit('load_group_history', history);
        } catch (error) {
            console.error(`Gagal mengambil riwayat grup ${room}:`, error);
        }
    });

    // Event 4: Kirim Pesan Grup
    socket.on('send_group_message', async (data) => {
        const pengirim = socket.username;
        const { room, pesan } = data;

        if (!room || !pesan || !pesan.trim()) return;

        try {
            const pesanBaru = new GroupMessage({
                room: room,
                pengirim: pengirim,
                pesan: pesan.trim()
            });
            await pesanBaru.save();

            // Broadcast ke room
            io.to(room).emit('receive_group_message', {
                _id: pesanBaru._id,
                room: pesanBaru.room,
                pengirim: pesanBaru.pengirim,
                pesan: pesanBaru.pesan,
                waktu: pesanBaru.waktu
            });

            // Trigger ke Node #4 (Notification Gateway)
            axios.post(NOTIFICATION_SERVICE_URL, {
                title: `[Grup ${room}] Pesan dari @${pengirim}`,
                message: pesan,
                type: 'info'
            }).catch(err => {
                console.error('⚠️ Gagal mengirim trigger notifikasi ke Node #4:', err.message);
            });

            console.log(`📢 [GRUP ${room}] Pesan dari @${pengirim} dikirim ke room & ditrigger ke Notification Gateway`);

        } catch (error) {
            console.error("Gagal menyimpan/mengirim pesan grup:", error);
            socket.emit('error_message', 'Gagal mengirim pesan ke grup.');
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ @${socket.username} terputus dari Group Chat Service.`);
    });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 Group Chat Service (Node #3 - Port ${PORT}) Running!`);
    console.log(`=================================`);
});