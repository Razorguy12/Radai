from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import model.model as model
from sqlalchemy.orm import Session
import json
from database import engine, Base, get_db, User, Report
import auth

# Create DB tables
Base.metadata.create_all(bind=engine)

# Load environment variables
load_dotenv()

app = FastAPI(title="Radiology Report Generator", version="1.0.0")

@app.on_event("startup")
def create_default_admin():
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

# Request model
class ReportRequest(BaseModel):
    """Input model for report generation"""
    patient_info: str
    study_info: str
    clinical_info: str = None
    radiologist_findings: str = None

class UserCreate(BaseModel):
    name: str
    username: str
    email: str
    password: str
    is_admin: bool = False

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
    """Health check endpoint"""
    return {
        "message": "Radiology Report Generator API",
        "endpoints": {
            "POST /generate-report": "Generate a radiology report",
            "GET /health": "Health check"
        }
    }

@app.post("/api/generate-report", response_model=model.RadiologyReport)
async def generate_report(request: ReportRequest, current_user: User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """
    Generate a structured radiology report from user input.
    
    Request body:
    - patient_info: Patient name, ID, age, etc.
    - study_info: Modality, study type, date
    - clinical_info: Clinical history and context (optional)
    
    Returns: RadiologyReport object
    """
    try:
        # Combine all input information
        combined_input = f"""
        Patient Information: {request.patient_info}
        Study Information: {request.study_info}
        Clinical Information: {request.clinical_info or 'Not provided'}
        Radiologist Findings: {request.radiologist_findings or 'Not provided'}
        """
        
        # Generate report using LLM
        report = model.generate_report(combined_input)
        report.radiologist_name = current_user.name
        
        # Save to database
        db_report = Report(
            user_id=current_user.id,
            patient_id=report.patient_id,
            patient_name=report.patient_name,
            modality=report.modality,
            report_data=report.json()
        )
        db.add(db_report)
        db.commit()
        
        return report
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate report: {str(e)}"
        )

@app.post("/api/generate-report-pdf")
async def generate_report_with_pdf(request: ReportRequest, current_user: User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """
    Generate a radiology report and convert it to PDF.
    
    Returns: PDF file download
    """
    try:
        # Combine all input information
        combined_input = f"""
        Patient Information: {request.patient_info}
        Study Information: {request.study_info}
        Clinical Information: {request.clinical_info or 'Not provided'}
        Radiologist Findings: {request.radiologist_findings or 'Not provided'}
        """
        
        # Generate report using LLM
        report = model.generate_report(combined_input)
        report.radiologist_name = current_user.name
        
        # Save to database
        db_report = Report(
            user_id=current_user.id,
            patient_id=report.patient_id,
            patient_name=report.patient_name,
            modality=report.modality,
            report_data=report.json()
        )
        db.add(db_report)
        db.commit()
        
        # Convert to PDF
        pdf_filename = model.report_to_pdf(report)
        
        # Return PDF as file response
        return FileResponse(
            pdf_filename,
            media_type="application/pdf",
            filename=pdf_filename
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate report PDF: {str(e)}"
        )

@app.post("/api/create-pdf-from-report")
async def create_pdf_from_report(report: model.RadiologyReport, current_user: User = Depends(auth.get_current_user)):
    """
    Generate a PDF directly from an edited RadiologyReport object.
    
    Returns: PDF file download
    """
    try:
        # Convert to PDF
        pdf_filename = model.report_to_pdf(report)
        
        # Return PDF as file response
        return FileResponse(
            pdf_filename,
            media_type="application/pdf",
            filename=pdf_filename
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create PDF from report: {str(e)}"
        )

@app.get("/api/reports")
async def get_my_reports(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    reports = db.query(Report).filter(Report.user_id == current_user.id).order_by(Report.created_at.desc()).all()
    return [{"id": r.id, "patient_id": r.patient_id, "patient_name": r.patient_name, "modality": r.modality, "created_at": r.created_at, "report_data": json.loads(r.report_data)} for r in reports]

@app.get("/api/admin/users/{user_id}/reports")
async def get_user_reports(user_id: int, db: Session = Depends(get_db), current_admin: User = Depends(auth.get_current_admin)):
    reports = db.query(Report).filter(Report.user_id == user_id).order_by(Report.created_at.desc()).all()
    return [{"id": r.id, "patient_id": r.patient_id, "patient_name": r.patient_name, "modality": r.modality, "created_at": r.created_at, "report_data": json.loads(r.report_data)} for r in reports]

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    api_key_status = "configured" if os.getenv("OPENAI_API_KEY") else "missing"
    return {
        "status": "healthy",
        "api_key": api_key_status
    }

# Mount frontend static files last, so it doesn't override API routes
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
