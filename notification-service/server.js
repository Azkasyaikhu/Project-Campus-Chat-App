const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Event saat ada device (client) yang terhubung ke server Adib
io.on('connection', (socket) => {
    console.log(`[+] Client terhubung dengan ID: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[-] Client terputus: ${socket.id}`);
    });
});

// Endpoint yang akan "ditembak" oleh kodingan Azka, Uqi, atau Hasbul
app.post('/api/notify', (req, res) => {
    const { title, message, type } = req.body;

    if (!title || !message) {
        return res.status(400).json({ success: false, error: 'Title dan Message wajib diisi!' });
    }

    // Broadcast notifikasi ke SEMUA client yang terhubung secara Real-Time
    io.emit('new_notification', {
        title: title,
        message: message,
        type: type || 'info', // 'info', 'success', 'warning', atau 'danger'
        timestamp: new Date().toLocaleTimeString('id-ID')
    });

    console.log(`[BROADCAST] ${title} - ${message}`);
    return res.json({ success: true, message: 'Notifikasi berhasil di-broadcast!' });
});

// Jalankan di port 3004 dan izinkan akses dari IP lokal (0.0.0.0)
const PORT = 3004;
server.listen(PORT, '0.0.0.0', () => {
    console.log(` Notification Service berjalan di port ${PORT}`);
});