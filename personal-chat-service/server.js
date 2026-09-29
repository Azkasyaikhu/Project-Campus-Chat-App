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

// MENYAJIKAN FILE HTML SECARA OTOMATIS
app.use(express.static('.'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// KONEKSI MONGODB ATLAS CLOUD (DATABASE: campus_chat)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas (Personal Chat Node #2) Terhubung!'))
    .catch(err => console.error('❌ Gagal Konek MongoDB:', err));

const messageSchema = new mongoose.Schema({
    pengirim: { type: String, required: true },
    penerima: { type: String, required: true },
    pesan: { type: String, required: true },
    waktu: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema, 'messages');

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
    
    socket.join(namaUser);
    console.log(`🔌 [LOG] ${namaUser} terhubung ke Room "${namaUser}" | Socket ID: ${socket.id}`);

    // Mengambil riwayat chat dari MongoDB
    socket.on('get_chat_history', async (data) => {
        const { pengirim, penerima } = data;
        try {
            const history = await Message.find({
                $or: [
                    { pengirim: pengirim, penerima: penerima },
                    { pengirim: penerima, penerima: pengirim }
                ]
            }).sort({ waktu: 1 });

            socket.emit('load_chat_history', history);
        } catch (error) {
            console.error("Gagal mengambil riwayat chat:", error);
        }
    });

    // Menerima dan meneruskan pesan
    socket.on('private_message', async (data) => {
        const pengirim = socket.username; 
        const { penerima, pesan } = data;

        try {
            const pesanBaru = new Message({ pengirim, penerima, pesan });
            await pesanBaru.save();

            // 1. Konfirmasi ke pengirim
            socket.emit('pesan_terkirim', { pengirim, penerima, pesan, waktu: pesanBaru.waktu });

            // 2. Kirim ke room penerima
            io.to(penerima).emit('terima_pesan', { pengirim, penerima, pesan, waktu: pesanBaru.waktu });

            // 3. Signal update badge/counter UI
            io.to(penerima).emit('pesan_baru', {
                type: 'personal',
                pengirim: pengirim
            });

            // 4. TRIGGER KE NODE #4 (NOTIFICATION GATEWAY) KHUSUS PENERIMA
            axios.post(NOTIFICATION_SERVICE_URL, {
                targetUser: penerima,
                title: `Pesan Baru dari @${pengirim}`,
                message: pesan,
                type: 'info'
            }).catch(err => {
                console.error('⚠️ Gagal mengirimkan trigger ke Notification Node:', err.message);
            });

            console.log(`📤 Pesan dari ${pengirim} dikirim real-time ke room ${penerima}`);
        } catch (error) {
            console.error("Gagal menyimpan pesan:", error);
            socket.emit('error_message', 'Gagal mengirim pesan ke server.');
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ ${socket.username} terputus dari jaringan.`);
    });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`✅ Personal Chat Service (Port ${PORT}) Running!`);
    console.log(`=================================`);
});