.PHONY: backend frontend install

backend:
	uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

install:
	pip install -r requirements.txt
	cd frontend && npm install
