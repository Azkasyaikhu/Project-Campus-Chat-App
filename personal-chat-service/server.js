const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// MENYAJIKAN FILE HTML SECARA OTOMATIS
// ==========================================
app.use(express.static('.'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ==========================================
// KONEKSI MONGODB ATLAS CLOUD (UNTUK CHAT)
// ==========================================
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat_messages?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas (Chat Service) Terhubung Berhasil!'))
    .catch(err => console.error('❌ Gagal Konek MongoDB:', err));

// Schema & Model Pesan agar Riwayat Tersimpan
const messageSchema = new mongoose.Schema({
    pengirim: { type: String, required: true },
    penerima: { type: String, required: true },
    pesan: { type: String, required: true },
    waktu: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// Daftar user yang sedang online
let penggunaOnline = {};

io.on('connection', (socket) => {
    console.log(`🔌 Klien terhubung dengan ID Socket: ${socket.id}`);

    // 1. Mendaftarkan user ke memori online
    socket.on('register_user', (namaUser) => {
        penggunaOnline[namaUser] = socket.id;
        console.log(`👤 User aktif: ${namaUser} (Socket ID: ${socket.id})`);
    });

    // 2. Mengambil riwayat chat dari MongoDB saat user memilih teman
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

    // 3. Menerima, Menyimpan, dan Meneruskan Pesan Secara Real-Time
    socket.on('private_message', async (data) => {
        const { pengirim, penerima, pesan } = data;

        try {
            // Simpan pesan ke MongoDB Atlas
            const pesanBaru = new Message({ pengirim, penerima, pesan });
            await pesanBaru.save();

            // Kirim konfirmasi ke pengirim
            socket.emit('pesan_terkirim', { pengirim, penerima, pesan });

            // Cek apakah penerima sedang online
            const socketIdPenerima = penggunaOnline[penerima];
            if (socketIdPenerima) {
                io.to(socketIdPenerima).emit('terima_pesan', { pengirim, penerima, pesan });
                console.log(`📤 Pesan dari ${pengirim} dikirim real-time ke ${penerima}`);
            } else {
                console.log(`ℹ️ Pesan untuk ${penerima} tersimpan di database (User offline).`);
            }
        } catch (error) {
            console.error("Gagal menyimpan pesan:", error);
            socket.emit('error_message', 'Gagal mengirim pesan ke server.');
        }
    });

    // 4. Handle saat user disconnect
    socket.on('disconnect', () => {
        for (let nama in penggunaOnline) {
            if (penggunaOnline[nama] === socket.id) {
                console.log(`❌ ${nama} terputus dari jaringan.`);
                delete penggunaOnline[nama];
                break;
            }
        }
    });
});

const PORT = 3002;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`Personal Chat Service Running!`);
    console.log(`Port: ${PORT}`);
    console.log(`=================================`);
});