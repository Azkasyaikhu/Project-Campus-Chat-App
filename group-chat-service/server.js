const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose'); // [BACKEND] Tambahkan Mongoose

const app = express();
app.use(cors());

// [UI/UX & FRONTEND] Mengirim file index.html ke browser
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// [DATABASE] KONEKSI MONGODB ATLAS CLOUD
// ==========================================
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ [DATABASE] Group Chat Service Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ [DATABASE] Connection Error:', err));

// ==========================================
// [DATABASE] SCHEMA & MODEL CHAT GRUP
// ==========================================
const groupMessageSchema = new mongoose.Schema({
    room: { type: String, required: true },
    sender: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

// ==========================================
// [BACKEND] SOCKET.IO SERVER
// ==========================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`[LOG] ⚡ User baru terkoneksi | ID Socket: ${socket.id}`);

    // 1. Join Room & Load History Chat
    socket.on('join_room', async (roomName) => {
        socket.join(roomName);
        console.log(`[LOG] 🚪 Socket ${socket.id} bergabung ke ruang: ${roomName}`);
        
        try {
            // Ambil 50 pesan terakhir dari database untuk room ini
            const history = await GroupMessage.find({ room: roomName })
                .sort({ timestamp: 1 })
                .limit(50);
            
            // Kirim riwayat chat hanya ke user yang baru join
            socket.emit('load_group_history', history);
        } catch (err) {
            console.error('[ERROR] Gagal memuat riwayat chat grup:', err);
        }

        // Notifikasi ke anggota lain di room
        socket.to(roomName).emit('system_notification', `Anggota baru bergabung ke ${roomName}`);
    });

    // 2. Menerima & Menyimpan Pesan Grup
    socket.on('send_group_message', async (data) => {
        try {
            // Simpan pesan ke MongoDB Atlas
            const newGroupMsg = new GroupMessage({
                room: data.room,
                sender: data.sender,
                message: data.message
            });
            await newGroupMsg.save();

            console.log(`[LOG] 💾 Pesan Grup Tersimpan di DB -> Ruang ${data.room} | Dari: ${data.sender}`);

            // Teruskan/Broadcast pesan ke semua orang di room tersebut beserta waktu dari DB
            socket.to(data.room).emit('receive_group_message', {
                room: data.room,
                sender: data.sender,
                message: data.message,
                timestamp: newGroupMsg.timestamp
            });

            // Kirim konfirmasi balik ke pengirim
            socket.emit('message_sent_success', newGroupMsg);

        } catch (err) {
            console.error('[ERROR] Gagal menyimpan pesan grup:', err);
            socket.emit('system_notification', 'Gagal mengirim pesan ke server.');
        }
    });

    socket.on('disconnect', () => {
        console.log(`[LOG] 🔴 User terputus: ${socket.id}`);
    });
});

const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`🌐 Group Chat Node (User 3) Running!`);
    console.log(`🔌 Port: ${PORT}`);
    console.log(`💻 Akses Lokal : http://localhost:${PORT}`);
    console.log(`===========================================`);
});