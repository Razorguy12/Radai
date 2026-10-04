# RadAI Reports — Radiology Portal

A FastAPI + React portal for radiologists to generate AI-assisted structured reports, review and edit them, and export professional PDFs.

## Features

- **React SPA** — Landing page, doctor dashboard, multi-step report wizard, preview/edit, admin panel
- **AI Report Generation** — Groq LLM produces structured findings, impressions, and recommendations
- **Doctor-in-the-Loop** — Edit reports inline, save to database, mark as draft or final
- **Voice Dictation & PDF Uploads** — Dictate clinical impressions directly via microphone (transcribed in real-time via Groq Whisper) or upload patient history PDFs to extract findings automatically
- **Standalone Medical Scan Viewer** — Attach study scans (CT, MRI, X-ray); view scans alone in an interactive darkroom viewer with film negative inversion mode (`Invert (Film)`) and zoom controls without cluttering the written report
- **Clean Unicode PDF Export** — High-resolution ReportLab PDF generation with TrueType Unicode font support (`LiberationSans`) and text sanitization (no missing glyphs or black blocks)
- **Mobile-Responsive UI** — Fully responsive mobile design with natural non-sticky scrolling navigation and responsive drawer menu
- **Modality Templates** — Quick-start templates for CT Chest, MRI Brain, Ultrasound, and more
- **JWT Auth** — Secure login with role-based admin user management

## Setup

### 1. Backend

```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add GROQ_API_KEY (and optionally DATABASE_URL, SECRET_KEY)
```

### 2. Frontend

```bash
cd web
npm install
npm run build   # production build → web/dist/
```

### 3. Run

**Development** (recommended — hot reload for frontend):

```bash
# Terminal 1 — API
python -m uvicorn main:app --reload

# Terminal 2 — React dev server (proxies /api to :8000)
cd web && npm run dev
```

Open `http://localhost:5173`

**Production** (single server serves API + built SPA):

```bash
cd web && npm run build
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`

API docs: `http://localhost:8000/docs`

## Project Structure

```
radiology/
├── main.py              # FastAPI app, API routes, static SPA serving
├── auth.py              # JWT + bcrypt authentication
├── database.py          # SQLAlchemy User/Report models & migrations
├── model/
│   ├── model.py         # Pydantic schemas, Groq LLM integration, ReportLab PDF generator
│   └── templates.json   # Modality study templates
├── web/                 # Modern React + Vite frontend
│   ├── src/
│   │   ├── pages/       # Landing, Login, Dashboard, Generate, ReportPreview, Admin
│   │   ├── components/  # AppHeader, ScanModal, AudioPdfControls, ReportCard, LoadingOverlay
│   │   ├── api/         # Axios API clients
│   │   └── context/     # AuthContext
│   └── dist/            # Production build output
└── frontend/legacy/     # Archived vanilla HTML (pre-React)
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Public landing page |
| `/login` | Doctor sign-in |
| `/dashboard` | Report history, stats, search/filter, and quick scan view |
| `/generate` | 4-step wizard with templates, voice dictation, PDF extract, and scan attachment |
| `/reports/:id` | Preview, edit, save, finalize, download PDF, and view scan alone |
| `/admin` | User management (admin only) |

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/token` | Public | Login & JWT generation |
| GET | `/api/reports` | User | List own reports |
| GET | `/api/reports/{id}` | User | Get single report with scan data |
| PATCH | `/api/reports/{id}` | User | Save edited report |
| PATCH | `/api/reports/{id}/status` | User | Set draft/final |
| POST | `/api/generate-report` | User | Generate + save report |
| POST | `/api/create-pdf-from-report` | User | Download clean formatted PDF |
| POST | `/api/extract-text-from-pdf` | User | Extract text from uploaded clinical PDF |
| POST | `/api/transcribe-audio` | User | Transcribe voice dictation audio via Groq Whisper |
| GET | `/api/templates` | User | Modality templates |
| GET | `/api/dashboard/stats` | User | Dashboard statistics |
| GET/POST | `/api/users` | Admin | List/create users |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for LLM and Whisper transcription |
| `DATABASE_URL` | No | PostgreSQL URL (falls back to SQLite) |
| `SECRET_KEY` | No | JWT secret (change in production) |

## Notes

- Reports have `draft` or `final` status; finalized reports cannot be edited.
- Attached scan images remain independent of the clinical text report and can be viewed on demand in the standalone viewer modal.
- Edits are persisted to the database.
- Default admin user is seeded on first startup (see `main.py`).


