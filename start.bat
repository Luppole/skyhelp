@echo off
title SkyHelper

setlocal

echo Starting FastAPI backend...
start "SkyHelper Backend" cmd /k "cd /d %~dp0 && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

echo Starting Vite frontend...
start "SkyHelper Frontend" cmd /k "cd /d %~dp0 && npm run dev"

timeout /t 2 /nobreak >nul

if not defined ICON_SOURCE_BASE (
  echo Skipping Icon Importer (ICON_SOURCE_BASE not set).
) else (
  echo Starting Icon Importer (optional)...
  start "SkyHelper Icon Importer" cmd /k "cd /d %~dp0 && python -m backend.tools.icon_importer 200"
)

timeout /t 2 /nobreak >nul

echo Opening browser...
start http://localhost:5173

endlocal
