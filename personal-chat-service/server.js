const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// ==========================================
// KONEKSI MONGODB ATLAS CLOUD
// ==========================================
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Chat Service (User 2): Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ Chat Service: Gagal koneksi ke MongoDB:', err));

// ==========================================
// SCHEMA & MODEL CHAT (MONGODB)
// ==========================================
const messageSchema = new mongoose.Schema({
    pengirim: { type: String, required: true },
    penerima: { type: String, required: true },
    pesan: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// ==========================================
// SOCKET.IO & HTTP SERVER
// ==========================================
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Mengizinkan koneksi dari IP mana saja
        methods: ["GET", "POST"]
    }
});

// Variabel memori untuk menyimpan daftar socket ID user yang sedang online
let penggunaOnline = {};

io.on('connection', (socket) => {
    console.log(`⚡ Ada perangkat terhubung | ID Socket: ${socket.id}`);

    // 1. Register User Online
    socket.on('register_user', (namaUser) => {
        if (namaUser) {
            penggunaOnline[namaUser] = socket.id;
            console.log(`👤 ${namaUser} masuk ke jaringan. Online:`, penggunaOnline);
        }
    });

    // 2. Ambil Riwayat Chat dari MongoDB Atlas
    socket.on('get_chat_history', async (data) => {
        const { pengirim, penerima } = data;
        try {
            // Cari semua pesan antara pengirim dan penerima
            const history = await Message.find({
                $or: [
                    { pengirim: pengirim, penerima: penerima },
                    { pengirim: penerima, penerima: pengirim }
                ]
            }).sort({ timestamp: 1 }); // Urutkan dari waktu lama ke baru

            socket.emit('load_chat_history', history);
        } catch (err) {
            console.error("Gagal mengambil riwayat chat:", err);
        }
    });

    // 3. Menerima & Menyimpan Pesan 1-on-1 (Private Message)
    socket.on('private_message', async (data) => {
        const { pengirim, penerima, pesan } = data;
        const socketIdPenerima = penggunaOnline[penerima];

        try {
            // A. SIMPAN KE MONGODB ATLAS CLOUD
            const newMessage = new Message({
                pengirim: pengirim,
                penerima: penerima,
                pesan: pesan
            });
            await newMessage.save();
            console.log(`💾 Pesan dari [${pengirim}] ke [${penerima}] berhasil disimpan ke MongoDB Cloud!`);

            // B. TERUSKAN SECARA REAL-TIME JIKA PENERIMA ONLINE
            if (socketIdPenerima) {
                io.to(socketIdPenerima).emit('terima_pesan', {
                    pengirim: pengirim,
                    penerima: penerima,
                    pesan: pesan,
                    timestamp: newMessage.timestamp
                });
                console.log(`📩 Pesan diteruskan secara realtime ke ${penerima}`);
            } else {
                console.log(`ℹ️ ${penerima} sedang offline. Pesan tetap tersimpan di database.`);
            }

            // Kirim konfirmasi balik ke pengirim bahwa pesan sukses terkirim/terseimpan
            socket.emit('pesan_terkirim', {
                pengirim: pengirim,
                penerima: penerima,
                pesan: pesan,
                timestamp: newMessage.timestamp
            });

        } catch (error) {
            console.error("❌ Gagal menyimpan pesan ke MongoDB:", error);
            socket.emit('error_message', 'Gagal mengirim & menyimpan pesan ke database.');
        }
    });

    // 4. User Disconnect
    socket.on('disconnect', () => {
        for (let nama in penggunaOnline) {
            if (penggunaOnline[nama] === socket.id) {
                console.log(`🔴 ${nama} keluar dari jaringan.`);
                delete penggunaOnline[nama];
                break;
            }
        }
    });
});

// Jalankan Server Port 3002
const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`✅ Chat Service (User 2) Running!`);
    console.log(`Port: ${PORT}`);
    console.log(`Akses Lokal : http://localhost:${PORT}`);
    console.log(`=================================`);
});