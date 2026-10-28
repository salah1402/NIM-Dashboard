# NIM Dashboard

Self-hosted chat UI routing to NVIDIA NIM free tier.
NVIDIA NIM is OpenAI-compatible (`base_url="https://integrate.api.nvidia.com/v1"`), with rate limits enforced **per model slug (40 RPM each)** rather than per account. Cascading across slugs multiplies overall throughput.

## Project Structure

```
nim-dashboard/
├── backend/
│   ├── __init__.py
│   ├── main.py          # FastAPI app (SSE streaming, /health, /api/chat)
│   ├── router.py        # FallbackRouter stub (tier model iteration)
│   ├── provider.py      # MockProvider returning fake streamed tokens
│   ├── models.py        # SQLAlchemy models (Conversation, Message)
│   └── config.py        # YAML config loader
├── frontend/            # Vite + React + Tailwind
│   ├── src/
│   │   ├── App.jsx      # Chat UI + message list + model_slug badges
│   │   ├── api.js       # API client pointing at http://localhost:8000
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js   # Proxy configuration to :8000
│   └── tailwind.config.js
├── config/
│   └── models.yaml      # Tiered cascade configuration
├── data/
│   └── .gitkeep         # SQLite database target (nim.db)
├── .env.example         # Template environment configuration
├── Makefile             # `make backend`, `make frontend`
├── requirements.txt     # Python backend dependencies
└── README.md
```

## Setup & Running

### 1. Backend (FastAPI on Port 8000)

Install dependencies:
```bash
pip install -r requirements.txt
```

Run the backend server:
```bash
uvicorn backend.main:app --reload
# Or via make:
# make backend
```
Backend will be live at `http://localhost:8000`.
Health endpoint: `http://localhost:8000/health`.

### 2. Frontend (Vite + React on Port 5173)

Install dependencies:
```bash
cd frontend
npm install
```

Run the development server:
```bash
npm run dev
# Or via make from root:
# make frontend
```
Frontend will be live at `http://localhost:5173`.
Vite dev server proxies `/api` and `/health` requests to `http://localhost:8000`.

## Phase 0 Verification

In Phase 0, all calls use `MockProvider`:
- No real network calls are made to NVIDIA NIM.
- No API key is required.
- Simulated token-by-token streaming response with realistic latency.
- Each assistant message displays its assigned model slug badge (e.g. `openai/gpt-oss-20b`, `meta/llama-3.1-8b-instruct`) and elapsed latency.
