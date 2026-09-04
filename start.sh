#!/bin/bash
# IRIS — one-command start: backend (FastAPI + OpenCV) + frontend (Vite dev)
set -e
cd "$(dirname "$0")"

# --- backend ---
cd backend
if [ ! -d .venv ]; then
  echo "· creating backend venv + installing deps (first run)…"
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
if ! curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
  echo "· starting IRIS backend on :8000 …"
  .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
  BACK_PID=$!
  sleep 6
else
  BACK_PID=""
  echo "· backend already running on :8000"
fi
cd ..

# --- frontend ---
cd frontend
if [ ! -d node_modules ]; then
  echo "· installing frontend deps (first run)…"
  npm install --no-audit --no-fund
fi
echo "· starting IRIS dashboard on http://localhost:5173  (Ctrl+C to stop)"
npm run dev

if [ -n "$BACK_PID" ]; then kill $BACK_PID 2>/dev/null; fi
