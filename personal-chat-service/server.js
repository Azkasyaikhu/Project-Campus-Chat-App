const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // [DITAMBAHKAN] Untuk verifikasi SSO

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'kunci_rahasia_campus_chat_2026';

// MENYAJIKAN FILE HTML SECARA OTOMATIS
app.use(express.static('.'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// KONEKSI MONGODB ATLAS CLOUD (UNTUK CHAT)
const MONGO_URI = "mongodb+srv://azkasyaikhu0917_db_user:aK5LAb4MHvy6mEpF@cluster0.v8j6a5q.mongodb.net/campus_chat_messages?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas (Personal Chat) Terhubung Berhasil!'))
    .catch(err => console.error('❌ Gagal Konek MongoDB:', err));

const messageSchema = new mongoose.Schema({
    pengirim: { type: String, required: true },
    penerima: { type: String, required: true },
    pesan: { type: String, required: true },
    waktu: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

let penggunaOnline = {};

// [DITAMBAHKAN] Middleware Socket Autentikasi JWT
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
    // Registrasi otomatis menggunakan identitas dari Token JWT
    const namaUser = socket.username;
    penggunaOnline[namaUser] = socket.id;
    console.log(`🔌 [LOG] ${namaUser} terhubung | Socket ID: ${socket.id}`);

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
        // [KEAMANAN] Pengirim otomatis menggunakan username dari Token, bukan dari inputan user
        const pengirim = socket.username; 
        const { penerima, pesan } = data;

        try {
            const pesanBaru = new Message({ pengirim, penerima, pesan });
            await pesanBaru.save();

            socket.emit('pesan_terkirim', { pengirim, penerima, pesan });

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

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`❌ ${socket.username} terputus dari jaringan.`);
        delete penggunaOnline[socket.username];
    });
});

const PORT = 3002;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`✅ Personal Chat Service (Port ${PORT}) Running!`);
    console.log(`=================================`);
});