const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { corsOptions, allowedOrigins, isOriginAllowed } = require('./config/cors');
const errorHandler = require('./middlewares/errorHandler');
const { initAI, getAIStats } = require('./services/ai.service');
const initializeSocket = require('./socket');

const colyseus = require('colyseus');
const { OfficeRoom } = require('./game/OfficeRoom');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    },
    maxHttpBufferSize: 1e8, // 100MB cho file transfer
    transports: ['websocket', 'polling'],
});

// Expose io to HTTP controllers (for real-time notifications from REST routes)
app.set('io', io);
app.set('socketio', io);

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roomRoutes = require('./routes/room.routes');
const uploadRoutes = require('./routes/upload.routes');
const friendRoutes = require('./routes/friend.routes');
const userActionsRoutes = require('./routes/user-actions.routes');
const adminRoutes = require('./routes/admin.routes');
const noteRoutes = require('./routes/note.routes');
const counselingRoutes = require('./routes/counseling.routes');
const topicRoutes = require('./routes/topic.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/user-actions', userActionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/counseling', counselingRoutes);
app.use('/api/topics', topicRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        server: 'Smart AI Chat Server',
        timestamp: new Date().toISOString(),
        ai: getAIStats(),
    });
});

app.get('/api/ice-servers', async (req, res) => {
    try {
        console.log(`❄️  ICE Servers requested by ${req.ip}`);
        const iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ];

        // If Metered.ca API key is configured, fetch real TURN credentials
        const meteredApiKey = process.env.METERED_API_KEY;
        const meteredDomain = process.env.METERED_DOMAIN || 'phucanh.metered.live';
        if (meteredApiKey) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            try {
                const response = await fetch(
                    `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredApiKey)}`,
                    { signal: controller.signal }
                );
                clearTimeout(timeout);
                if (response.ok) {
                    const turnServers = await response.json();
                    const normalized = turnServers.map(s => ({
                        urls: s.urls || s.url,
                        ...(s.username && { username: s.username }),
                        ...(s.credential && { credential: s.credential }),
                    })).filter(s => s.urls);
                    iceServers.push(...normalized);
                    console.log(`✅ Fetched ${normalized.length} TURN servers from Metered.ca`);
                } else {
                    console.warn('⚠️ Failed to fetch Metered TURN credentials:', response.status);
                }
            } catch (fetchErr) {
                clearTimeout(timeout);
                console.warn('⚠️ Metered API timeout/error:', fetchErr.message);
            }
        }

        // Manual TURN server from env vars
        const turnUrl = process.env.TURN_URL;
        const turnUser = process.env.TURN_USERNAME;
        const turnCred = process.env.TURN_CREDENTIAL;
        if (turnUrl) {
            iceServers.push({
                urls: turnUrl.split(',').map(u => u.trim()),
                username: turnUser || '',
                credential: turnCred || '',
            });
            console.log('✅ Using TURN servers from TURN_URL env');
        }

        // Self-hosted coturn (docker-compose.prod.yml): mật khẩu tạm theo chuẩn TURN REST API,
        // username = "<hạn dùng>:<tên>", credential = HMAC-SHA1(TURN_SECRET, username), hết hạn sau 24 giờ
        const turnSecret = process.env.TURN_SECRET;
        const turnHost = process.env.DOMAIN;
        if (turnSecret && turnHost) {
            const username = `${Math.floor(Date.now() / 1000) + 24 * 3600}:smartai`;
            const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');
            iceServers.push({
                urls: [`turn:${turnHost}:3478?transport=udp`, `turn:${turnHost}:3478?transport=tcp`],
                username,
                credential,
            });
        }

        res.json({ iceServers });
    } catch (error) {
        console.error('ICE servers error:', error.message);
        res.json({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });
    }
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // 1. Kết nối MongoDB
        await connectDB();

        // 2. Khởi tạo Gemini AI
        initAI();

        // 3. Khởi tạo Socket.io handlers
        initializeSocket(io);

        // 4. Start HTTP Server (Socket.io)
        server.listen(PORT, () => {
            console.log(`\n🚀 ═══════════════════════════════════════════════`);
            console.log(`   Smart AI Chat Server`);
            console.log(`   HTTP:   http://localhost:${PORT}`);
            console.log(`   Socket: ws://localhost:${PORT}`);
            console.log(`   Env:    ${process.env.NODE_ENV || 'development'}`);
            console.log(`═══════════════════════════════════════════════════\n`);
        });

        // 5. Start Colyseus Game Server (independent port — no conflict with Socket.io)
        const COLYSEUS_PORT = process.env.COLYSEUS_PORT || 2567;
        const gameServer = new colyseus.Server({
            server: http.createServer(), // separate HTTP server for Colyseus
        });
        gameServer.define('office', OfficeRoom);
        gameServer.listen(COLYSEUS_PORT).then(() => {
            console.log(`🏢 ═══════════════════════════════════════════════`);
            console.log(`   Colyseus Game Server`);
            console.log(`   WS: ws://localhost:${COLYSEUS_PORT}`);
            console.log(`   Env:    ${process.env.NODE_ENV || 'development'}`);
            console.log(`═══════════════════════════════════════════════════\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();
