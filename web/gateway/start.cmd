@echo off
rem The WhatsApp gateway on the laptop (the backup when Render is off). Double-click it, or put a
rem shortcut to it in shell:startup. It reads .env here; stop Render first: one gateway at a time.
cd /d "%~dp0"
if not exist node_modules call npm install
npm start
