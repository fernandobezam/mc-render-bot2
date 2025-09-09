const TelegramBot = require('node-telegram-bot-api');
const SftpClient = require('ssh2-sftp-client');
const axios = require('axios');
const express = require('express');

// ----------------- Configurações -----------------
// Se existir variável de ambiente, usa ela. Caso contrário, usa valor antigo.
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8428836196:AAHXQM4lGrEr6dX5yP5KpeAtgmkjyn3w6zs";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-4973751666";
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || "sk-e8f9ec2d827a4e8580ee1e08c9e5212b";

const FTP_HOST = process.env.FTP_HOST || "167.114.35.185";
const FTP_PORT = parseInt(process.env.FTP_PORT) || 8822;
const FTP_USER = process.env.FTP_USER || "fernandob";
const FTP_PASS = process.env.FTP_PASS || "Bezam9727@";
const FTP_PROTOCOL = process.env.FTP_PROTOCOL || "sftp";

const MC_LOG_DIR = process.env.MC_LOG_DIR || "/167.114.35.185_26245/logs/kubejs";
const MC_CRASH_DIR = process.env.MC_CRASH_DIR || "/167.114.35.185_26245/logs/kubejs/crash-reports";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 10000;

// ----------------- Bot Telegram -----------------
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
function sendTelegram(msg) {
    bot.sendMessage(TELEGRAM_CHAT_ID, msg).catch(console.error);
}

// ----------------- DeepSeek -----------------
async function analyzeCrash(text) {
    try {
        const payload = {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "Você é um assistente especialista em servidores Minecraft. Analise crash logs e explique causa provável em português." },
                { role: "user", content: text.slice(0, 6000) }
            ],
            max_tokens: 600
        };
        const res = await axios.post("https://api.deepseek.com/v1/chat/completions", payload, {
            headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" }
        });
        return res.data?.choices?.[0]?.message?.content || "Sem análise da DeepSeek.";
    } catch (err) {
        console.error("Erro DeepSeek:", err?.message || err);
        return "Erro ao analisar crash.";
    }
}

// ----------------- Monitoramento dos logs -----------------
let lastLinesSent = {}; // guarda quantas linhas já foram enviadas de cada arquivo

async function monitorLogs() {
    const sftp = new SftpClient();
    try {
        await sftp.connect({
            host: FTP_HOST,
            port: FTP_PORT,
            username: FTP_USER,
            password: FTP_PASS
        });

        // Lista arquivos .log
        const files = await sftp.list(MC_LOG_DIR);
        const logFiles = files.filter(f => f.name.endsWith(".log"));

        for (const f of logFiles) {
            try {
                const content = await sftp.get(`${MC_LOG_DIR}/${f.name}`);
                const lines = content.toString().split("\n");

                if (!lastLinesSent[f.name]) lastLinesSent[f.name] = 0;
                const newLines = lines.slice(lastLinesSent[f.name]);

                for (const line of newLines) {
                    if (line.trim()) sendTelegram(`📜 [${f.name}] ${line}`);
                }

                lastLinesSent[f.name] = lines.length;
            } catch (err) {
                console.error(`Erro lendo ${f.name}:`, err.message || err);
            }
        }

        // Crash reports
        try {
            const crashFiles = await sftp.list(MC_CRASH_DIR);
            for (const f of crashFiles) {
                if (f.name.endsWith(".txt") && !lastLinesSent[`crash-${f.name}`]) {
                    const content = await sftp.get(`${MC_CRASH_DIR}/${f.name}`);
                    sendTelegram(`⚠️ Crash detectado: ${f.name}\nAnalisando...`);
                    const analysis = await analyzeCrash(content.toString());
                    sendTelegram(`📝 Análise DeepSeek:\n${analysis}`);
                    lastLinesSent[`crash-${f.name}`] = true;
                }
            }
        } catch (err) {
            console.log("Nenhum crash report encontrado ou erro ao acessar crash-reports.");
        }

        await sftp.end();
    } catch (err) {
        console.error("Erro SFTP:", err?.message || err);
        try { await sftp.end(); } catch {}
    }
}

// ----------------- Express para manter ativo -----------------
const app = express();
app.get('/', (_req, res) => res.send('mc-render-bot ok'));
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Express rodando na porta ${port}`));

// ----------------- Loop -----------------
console.log("🤖 mc-render-bot rodando...");
setInterval(monitorLogs, POLL_INTERVAL_MS);
setTimeout(monitorLogs, 2000);
