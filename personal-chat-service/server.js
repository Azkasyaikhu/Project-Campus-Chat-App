const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Membuat HTTP server
const server = http.createServer(app);

// Inisialisasi Socket.io dengan izin CORS (agar bisa diakses laptop teman)
const io = new Server(server, {
    cors: {
        origin: "*", // Mengizinkan koneksi dari IP mana saja
        methods: ["GET", "POST"]
    }
});

// Variabel sementara untuk menyimpan data siapa saja yang sedang online
// Format: { "nama_user": "id_socket_mereka" }
let penggunaOnline = {};

// Event saat ada user (klien) yang terhubung ke server ini
io.on('connection', (socket) => {
    console.log(`Ada perangkat yang terhubung dengan ID Socket: ${socket.id}`);

    // 1. Menerima event saat user mendaftarkan namanya
    socket.on('register_user', (namaUser) => {
        penggunaOnline[namaUser] = socket.id;
        console.log(`${namaUser} masuk ke jaringan. Daftar online:`, penggunaOnline);
    });

    // 2. Menerima pesan 1-on-1 (Private Message)
    socket.on('private_message', (data) => {
        const { pengirim, penerima, pesan } = data;
        const socketIdPenerima = penggunaOnline[penerima];

        // Jika penerimanya ada dan sedang online, kirim pesannya ke dia!
        if (socketIdPenerima) {
            io.to(socketIdPenerima).emit('terima_pesan', {
                pengirim: pengirim,
                pesan: pesan
            });
            console.log(`Pesan dari ${pengirim} diteruskan ke ${penerima}`);
        } else {
            console.log(`Pesan gagal, ${penerima} sedang offline.`);
            // Beritahu pengirim kalau temannya offline
            socket.emit('error_message', `User ${penerima} tidak ditemukan atau offline.`);
        }
    });

    // 3. Event saat user keluar/putus koneksi
    socket.on('disconnect', () => {
        // Hapus user dari daftar online
        for (let nama in penggunaOnline) {
            if (penggunaOnline[nama] === socket.id) {
                console.log(`${nama} keluar dari jaringan.`);
                delete penggunaOnline[nama];
                break;
            }
        }
    });
});

// Jalankan server khusus untuk Personal Chat di port 3002
const PORT = 3002;
server.listen(PORT, () => {
    console.log(`✅ Layanan Personal Chat berjalan di http://localhost:${PORT}`);
});