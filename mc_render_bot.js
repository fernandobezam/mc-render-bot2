require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { Rcon } = require('rcon-client');

// Telegram
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const chatId = process.env.TELEGRAM_CHAT_ID;

// Diretórios
const logFile = path.join(process.env.MC_LOG_DIR, 'server.log');
const crashDir = process.env.MC_CRASH_DIR;

// Monitorar server.log para chat e join/leave
let fileSize = 0;
setInterval(() => {
    fs.stat(logFile, (err, stats) => {
        if (err) return;
        if (stats.size > fileSize) {
            const stream = fs.createReadStream(logFile, { start: fileSize, end: stats.size });
            stream.on('data', (chunk) => {
                const lines = chunk.toString().split(/\r?\n/);
                lines.forEach(line => {
                    if (line.includes('joined the game')) {
                        bot.sendMessage(chatId, `🟢 Player entrou: ${line}`);
                    } else if (line.includes('left the game')) {
                        bot.sendMessage(chatId, `🔴 Player saiu: ${line}`);
                    } else if (line.includes('<')) { // Chat
                        bot.sendMessage(chatId, `💬 Chat: ${line}`);
                    }
                });
            });
            fileSize = stats.size;
        }
    });
}, parseInt(process.env.POLL_INTERVAL_MS, 10) || 10000);

// Monitorar crash reports
fs.watch(crashDir, (eventType, filename) => {
    if (filename && eventType === 'rename') {
        bot.sendMessage(chatId, `💥 Crash detectado: ${filename}`);
    }
});

// Conectar RCON para players online e ping
async function connectRcon() {
    const rcon = new Rcon({
        host: process.env.RCON_HOST,
        port: parseInt(process.env.RCON_PORT),
        password: process.env.RCON_PASS
    });

    await rcon.connect();
    console.log('RCON conectado!');

    setInterval(async () => {
        try {
            const response = await rcon.send('list');
            bot.sendMessage(chatId, `📋 Players online: ${response}`);
            
            // Opcional: pegar ping individual se o comando /ping estiver disponível
            const match = response.match(/: (.*)/);
            if(match && match[1]) {
                const players = match[1].split(', ');
                for(const player of players) {
                    try {
                        const ping = await rcon.send(`/ping ${player}`);
                        bot.sendMessage(chatId, `🏓 ${player} ping: ${ping}`);
                    } catch {}
                }
            }

        } catch (err) {
            console.error('Erro RCON:', err);
        }
    }, 30000); // a cada 30s
}

connectRcon();
