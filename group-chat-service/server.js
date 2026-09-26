const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// Mengizinkan laptop teman-temanmu (beda IP) untuk mengakses server ini
app.use(cors());

const server = http.createServer(app);

// Inisialisasi Socket.io sebagai Inter-Process Interface (IPI)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Logika ketika ada user / laptop lain yang terhubung
io.on('connection', (socket) => {
    console.log(`[LOG] User baru terkoneksi dengan ID Socket: ${socket.id}`);

    // FITUR 1: User bergabung ke dalam sebuah Room / Kelas
    socket.on('join_room', (roomName) => {
        socket.join(roomName);
        console.log(`[LOG] Socket ${socket.id} bergabung ke ruang: ${roomName}`);
        
        // Memberi tahu orang lain di room yang sama kalau ada yang baru masuk
        socket.to(roomName).emit('system_notification', `Anggota baru bergabung ke ${roomName}`);
    });

    // FITUR 2: User mengirim pesan ke Room
    socket.on('send_group_message', (data) => {
        // data berisi: { room: 'Sisdir', sender: 'Umam', message: 'Halo!' }
        
        // Broadcast (sebar) pesan HANYA ke orang-orang yang ada di room tersebut
        socket.to(data.room).emit('receive_group_message', data);
        console.log(`[LOG] Pesan dari ${data.sender} di ruang ${data.room}: ${data.message}`);
    });

    // Logika ketika user menutup aplikasi/browser
    socket.on('disconnect', () => {
        console.log(`[LOG] User terputus: ${socket.id}`);
    });
});

// Menjalankan server di Port 3003 (Sesuai jatah pembagian tugasmu)
const PORT = 3003;
// '0.0.0.0' digunakan agar server bisa diakses lewat IP LAN/Wi-Fi oleh laptop lain
server.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`GROUP CHAT SERVICE Aktif di Port: ${PORT}`);
    console.log(`Menunggu koneksi Inter-Process Communication...`);
    console.log(`===========================================`);
});