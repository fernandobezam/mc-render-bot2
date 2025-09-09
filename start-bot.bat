@echo off
REM --- Diretório do bot ---
cd /d "C:\Users\ferna\OneDrive\Área de Trabalho\Nova pasta\mc-render-bot"

REM --- Variáveis de ambiente ---
set TELEGRAM_TOKEN=8428836196:AAHXQM4lGrEr6dX5yP5KpeAtgmkjyn3w6zs
set TELEGRAM_CHAT_ID=-4973751666
set DEEPSEEK_KEY=sk-e8f9ec2d827a4e8580ee1e08c9e5212b
set FTP_HOST=167.114.35.185
set FTP_PORT=8822
set FTP_USER=fernandob
set FTP_PASS=Bezam9727@
set FTP_PROTOCOL=sftp
set MC_LOG_DIR=/167.114.35.185_26245/logs/kubejs
set MC_CRASH_DIR=/167.114.35.185_26245/logs/kubejs/crash-reports
set POLL_INTERVAL_MS=10000

REM --- Rodar o bot ---
node mc_render_bot.js

pause
