from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os
import io
import json
import datetime
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq
import pdfplumber
import model.model as model
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from database import engine, Base, get_db, User, Report, run_migrations
import auth

# Create DB tables and apply column migrations for existing databases
Base.metadata.create_all(bind=engine)
run_migrations(engine)

# Load environment variables
load_dotenv()

app = FastAPI(title="Radiology Report Generator", version="1.0.0")

@app.on_event("startup")
def startup():
    run_migrations(engine)
    db = next(get_db())
    admin = db.query(User).filter(User.username == "azharsait2006").first()
    if not admin:
        new_admin = User(
            name="Azhar Sait",
            username="azharsait2006",
            email="azhar.sait@outlook.com",
            hashed_password=auth.get_password_hash("Azba@2001"),
            is_admin=True
        )
        db.add(new_admin)
        db.commit()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request models
class ReportRequest(BaseModel):
    patient_info: str
    study_info: str
    clinical_info: Optional[str] = None
    radiologist_findings: Optional[str] = None
    scan_image: Optional[str] = None
    scan_image_name: Optional[str] = None

class UserCreate(BaseModel):
    name: str
    username: str
    email: str
    password: str
    is_admin: bool = False

class ReportUpdate(BaseModel):
    report_data: model.RadiologyReport

class StatusUpdate(BaseModel):
    status: str

class GenerateReportResponse(BaseModel):
    id: int
    report: model.RadiologyReport

def serialize_report(r: Report) -> dict:
    input_params = None
    if r.input_params:
        try:
            input_params = json.loads(r.input_params)
        except json.JSONDecodeError:
            pass
    report_dict = json.loads(r.report_data)
    if getattr(r, "scan_image", None) and not report_dict.get("scan_image"):
        report_dict["scan_image"] = r.scan_image
        report_dict["scan_image_name"] = r.scan_image_name
    return {
        "id": r.id,
        "patient_id": r.patient_id,
        "patient_name": r.patient_name,
        "modality": r.modality,
        "status": getattr(r, "status", None) or "draft",
        "created_at": r.created_at,
        "updated_at": getattr(r, "updated_at", None) or r.created_at,
        "report_data": report_dict,
        "input_params": input_params,
        "scan_image": getattr(r, "scan_image", None),
        "scan_image_name": getattr(r, "scan_image_name", None),
    }

def get_report_or_404(report_id: int, db: Session) -> Report:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

def check_report_access(report: Report, user: User):
    if report.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this report")

@app.post("/api/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "is_admin": user.is_admin, "name": user.name}

@app.get("/api/users/me")
async def read_users_me(current_user: User = Depends(auth.get_current_user)):
    return {"name": current_user.name, "username": current_user.username, "email": current_user.email, "is_admin": current_user.is_admin}

@app.post("/api/users")
async def create_user(user: UserCreate, db: Session = Depends(get_db), current_admin: User = Depends(auth.get_current_admin)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    new_user = User(
        name=user.name,
        username=user.username,
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        is_admin=user.is_admin
    )
    db.add(new_user)
    db.commit()
    return {"msg": "User created successfully"}

@app.get("/api/users")
async def list_users(db: Session = Depends(get_db), current_admin: User = Depends(auth.get_current_admin)):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "username": u.username, "email": u.email, "is_admin": u.is_admin} for u in users]

@app.get("/api/")
async def root():
    return {
        "message": "Radiology Report Generator API",
        "endpoints": {
            "POST /generate-report": "Generate a radiology report",
            "GET /health": "Health check"
        }
    }

@app.get("/api/templates")
async def get_templates(current_user: User = Depends(auth.get_current_user)):
    templates_path = Path(__file__).parent / "model" / "templates.json"
    with open(templates_path) as f:
        return json.load(f)

@app.get("/api/dashboard/stats")
async def dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    reports = db.query(Report).filter(Report.user_id == current_user.id).all()
    now = datetime.datetime.utcnow()
    week_ago = now - datetime.timedelta(days=7)
    by_modality: dict[str, int] = {}
    this_week = 0
    drafts = 0
    for r in reports:
        by_modality[r.modality] = by_modality.get(r.modality, 0) + 1
        if r.created_at and r.created_at >= week_ago:
            this_week += 1
        status = getattr(r, "status", None) or "draft"
        if status == "draft":
            drafts += 1
    return {
        "total": len(reports),
        "this_week": this_week,
        "drafts": drafts,
        "by_modality": by_modality,
    }

@app.post("/api/generate-report", response_model=GenerateReportResponse)
async def generate_report(request: ReportRequest, current_user: User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    try:
        combined_input = f"""
        Patient Information: {request.patient_info}
        Study Information: {request.study_info}
        Clinical Information: {request.clinical_info or 'Not provided'}
        Radiologist Findings: {request.radiologist_findings or 'Not provided'}
        """

        report = model.generate_report(combined_input)
        report.radiologist_name = current_user.name

        if request.scan_image:
            report.scan_image = request.scan_image
            report.scan_image_name = request.scan_image_name

        input_params = json.dumps({
            "patient_info": request.patient_info,
            "study_info": request.study_info,
            "clinical_info": request.clinical_info,
            "radiologist_findings": request.radiologist_findings,
            "scan_image_name": request.scan_image_name,
        })

        now = datetime.datetime.utcnow()
        db_report = Report(
            user_id=current_user.id,
            patient_id=report.patient_id,
            patient_name=report.patient_name,
            modality=report.modality,
            status="draft",
            created_at=now,
            updated_at=now,
            report_data=report.model_dump_json(),
            input_params=input_params,
            scan_image=request.scan_image,
            scan_image_name=request.scan_image_name,
        )
        db.add(db_report)
        db.commit()
        db.refresh(db_report)

        return GenerateReportResponse(id=db_report.id, report=report)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/api/generate-report-pdf")
async def generate_report_with_pdf(request: ReportRequest, current_user: User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    try:
        combined_input = f"""
        Patient Information: {request.patient_info}
        Study Information: {request.study_info}
        Clinical Information: {request.clinical_info or 'Not provided'}
        Radiologist Findings: {request.radiologist_findings or 'Not provided'}
        """

        report = model.generate_report(combined_input)
        report.radiologist_name = current_user.name
        if request.scan_image:
            report.scan_image = request.scan_image
            report.scan_image_name = request.scan_image_name

        now = datetime.datetime.utcnow()
        db_report = Report(
            user_id=current_user.id,
            patient_id=report.patient_id,
            patient_name=report.patient_name,
            modality=report.modality,
            status="draft",
            created_at=now,
            updated_at=now,
            report_data=report.model_dump_json(),
            input_params=json.dumps({
                "patient_info": request.patient_info,
                "study_info": request.study_info,
                "clinical_info": request.clinical_info,
                "radiologist_findings": request.radiologist_findings,
                "scan_image_name": request.scan_image_name,
            }),
            scan_image=request.scan_image,
            scan_image_name=request.scan_image_name,
        )
        db.add(db_report)
        db.commit()

        pdf_filename = model.report_to_pdf(report)
        return FileResponse(pdf_filename, media_type="application/pdf", filename=pdf_filename)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report PDF: {str(e)}")

@app.post("/api/create-pdf-from-report")
async def create_pdf_from_report(report: model.RadiologyReport, current_user: User = Depends(auth.get_current_user)):
    try:
        pdf_filename = model.report_to_pdf(report)
        return FileResponse(pdf_filename, media_type="application/pdf", filename=pdf_filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create PDF from report: {str(e)}")

@app.post("/api/extract-text-from-pdf")
async def extract_text_from_pdf(file: UploadFile = File(...), current_user: User = Depends(auth.get_current_user)):
    """Extract text from uploaded patient history or findings PDF."""
    if not (file.filename and file.filename.lower().endswith(".pdf")):
        raise HTTPException(status_code=400, detail="Please upload a valid PDF file (.pdf)")
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages_text = []
            for page in pdf.pages:
                text_content = page.extract_text()
                if text_content:
                    pages_text.append(text_content.strip())
            
            full_text = "\n\n".join(pages_text).strip()
            return {
                "filename": file.filename,
                "page_count": len(pdf.pages),
                "text": full_text,
                "has_text": len(full_text) > 0,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF document: {str(e)}")

@app.post("/api/transcribe-audio")
async def transcribe_audio(file: UploadFile = File(...), current_user: User = Depends(auth.get_current_user)):
    """Transcribe audio dictation or uploaded sound file using Groq Whisper."""
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty")
        
        filename = file.filename or "dictation.webm"
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        transcription = client.audio.transcriptions.create(
            file=(filename, content),
            model="whisper-large-v3-turbo",
            response_format="json"
        )
        return {"text": transcription.text.strip(), "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")

@app.get("/api/reports")
async def get_my_reports(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    reports = db.query(Report).filter(Report.user_id == current_user.id).order_by(Report.created_at.desc()).all()
    return [serialize_report(r) for r in reports]

@app.get("/api/reports/{report_id}")
async def get_report(report_id: int, db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    report = get_report_or_404(report_id, db)
    check_report_access(report, current_user)
    return serialize_report(report)

@app.patch("/api/reports/{report_id}")
async def update_report(report_id: int, body: ReportUpdate, db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    report = get_report_or_404(report_id, db)
    check_report_access(report, current_user)
    if getattr(report, "status", "draft") == "final":
        raise HTTPException(status_code=400, detail="Cannot edit a finalized report")

    # Preserve or update scan_image on report_data
    if body.report_data.scan_image:
        report.scan_image = body.report_data.scan_image
        report.scan_image_name = body.report_data.scan_image_name
    elif report.scan_image and not body.report_data.scan_image:
        body.report_data.scan_image = report.scan_image
        body.report_data.scan_image_name = report.scan_image_name

    report.report_data = body.report_data.model_dump_json()
    report.patient_id = body.report_data.patient_id
    report.patient_name = body.report_data.patient_name
    report.modality = body.report_data.modality
    report.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(report)
    return serialize_report(report)

@app.patch("/api/reports/{report_id}/status")
async def update_report_status(report_id: int, body: StatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    if body.status not in ("draft", "final"):
        raise HTTPException(status_code=400, detail="Status must be 'draft' or 'final'")
    report = get_report_or_404(report_id, db)
    check_report_access(report, current_user)
    report.status = body.status
    report.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(report)
    return serialize_report(report)

@app.get("/api/admin/users/{user_id}/reports")
async def get_user_reports(user_id: int, db: Session = Depends(get_db), current_admin: User = Depends(auth.get_current_admin)):
    reports = db.query(Report).filter(Report.user_id == user_id).order_by(Report.created_at.desc()).all()
    return [serialize_report(r) for r in reports]

@app.get("/api/health")
async def health_check():
    api_key_status = "configured" if os.getenv("GROQ_API_KEY") else "missing"
    return {"status": "healthy", "api_key": api_key_status}

# Serve React SPA (with fallback for client-side routes like /dashboard)
dist_path = Path(__file__).parent / "web" / "dist"
if dist_path.exists():
    assets_path = dist_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        file_path = dist_path / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_path / "index.html")
else:
    legacy_path = Path(__file__).parent / "frontend"
    if legacy_path.exists():
        app.mount("/", StaticFiles(directory=str(legacy_path), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
