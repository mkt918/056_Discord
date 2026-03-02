@echo off
echo [Antigravity] Starting Setup...
IF NOT EXIST .env (
    copy .env.example .env
    echo [Antigravity] .env created. Please edit it with your token.
)
echo [Antigravity] Installing dependencies...
npm install
echo [Antigravity] Setup complete. Run 'npm run dev' to start.
pause
