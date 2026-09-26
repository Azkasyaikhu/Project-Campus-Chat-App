const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path'); // [BARU] Modul bawaan Node.js untuk membaca letak file

const app = express();
app.use(cors());

// [BARU] Mengirim file index.html ketika alamat localhost dibuka di browser
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`[LOG] User baru terkoneksi dengan ID Socket: ${socket.id}`);

    socket.on('join_room', (roomName) => {
        socket.join(roomName);
        console.log(`[LOG] Socket ${socket.id} bergabung ke ruang: ${roomName}`);
        socket.to(roomName).emit('system_notification', `Anggota baru bergabung ke ${roomName}`);
    });

    socket.on('send_group_message', (data) => {
        socket.to(data.room).emit('receive_group_message', data);
        console.log(`[LOG] Pesan dari ${data.sender} di ruang ${data.room}: ${data.message}`);
    });

    socket.on('disconnect', () => {
        console.log(`[LOG] User terputus: ${socket.id}`);
    });
});

const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`✅ Layanan Group Chat berjalan di http://localhost:${PORT}`);
    console.log(`===========================================`);
});