@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist server\data\lingoloop.db call npm run seed
start "LingoLoop" http://127.0.0.1:7100/
call npm run dev
