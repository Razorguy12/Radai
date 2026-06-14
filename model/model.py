from pydantic import BaseModel, Field
from typing import Optional
from groq import Groq
from dotenv import load_dotenv
import os
import json
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from datetime import datetime

# Load environment variables
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# ==================== Pydantic Models ====================

class RadiologyFinding(BaseModel):
    """Individual finding in the radiology report"""
    location: str = Field(..., description="Anatomical location of the finding")
    description: str = Field(..., description="Description of the finding")
    severity: str = Field(default="mild", description="Severity level: mild, moderate, severe")


class RadiologyReport(BaseModel):
    """Complete radiology report structure"""
    patient_name: str = Field(..., description="Patient name")
    patient_id: str = Field(..., description="Patient ID")
    study_date: str = Field(..., description="Date of study")
    modality: str = Field(..., description="Type of imaging: CT, MRI, X-ray, Ultrasound, etc.")
    study_type: str = Field(..., description="Type of study performed")
    findings: list[RadiologyFinding] = Field(..., description="List of findings")
    impression: str = Field(..., description="Clinical impression and conclusion")
    recommendations: Optional[list[str]] = Field(default=None, description="Clinical recommendations")
    radiologist_name: Optional[str] = Field(default="Dr. System", description="Radiologist name")

# ==================== Report Generation ====================

def generate_report(user_input: str) -> RadiologyReport:
    """
    Generate a structured radiology report using Groq API.
    
    Args:
        user_input: Key information about the imaging study
        
    Returns:
        RadiologyReport: Structured report as Pydantic model
    """
    client = Groq(api_key=GROQ_API_KEY)
    schema = RadiologyReport.model_json_schema()
    
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "system",
                "content": f"""You are an expert radiologist. Generate comprehensive, 
                realistic, and plausible radiology reports based on the information provided. 
                Ensure all findings are clinically appropriate and well-documented.
                
                You MUST return a JSON object that strictly adheres to the following JSON schema:
                {json.dumps(schema)}""",
            },
            {
                "role": "user",
                "content": f"""Based on the following key information, generate a complete radiology report:
                
                {user_input}
                
                Provide findings with appropriate anatomical locations and clinical severity levels.""",
            },
        ],
        response_format={"type": "json_object"},
    )
    
    report_dict = json.loads(response.choices[0].message.content)
    report = RadiologyReport.model_validate(report_dict)
    return report

# ==================== PDF Generation ====================

def report_to_pdf(report: RadiologyReport, filename: str = None) -> str:
    """
    Convert a RadiologyReport to a PDF file.
    
    Args:
        report: RadiologyReport object
        filename: Output filename (optional, generates one if not provided)
        
    Returns:
        str: Path to the generated PDF file
    """
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"radiology_report_{report.patient_id}_{timestamp}.pdf"
    
    # Create PDF
    doc = SimpleDocTemplate(filename, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1f4788'),
        spaceAfter=12,
        alignment=1  # Center
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#1f4788'),
        spaceAfter=6,
        spaceBefore=6
    )
    
    # Title
    elements.append(Paragraph("RADIOLOGY REPORT", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Patient Information Table
    patient_data = [
        ["Patient Name", report.patient_name],
        ["Patient ID", report.patient_id],
        ["Study Date", report.study_date],
        ["Modality", report.modality],
        ["Study Type", report.study_type],
    ]
    
    patient_table = Table(patient_data, colWidths=[2*inch, 4*inch])
    patient_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e8f0f7')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    
    elements.append(patient_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Findings Section
    elements.append(Paragraph("FINDINGS", heading_style))
    for i, finding in enumerate(report.findings, 1):
        finding_text = f"<b>{i}. {finding.location}</b> ({finding.severity.upper()})<br/>{finding.description}"
        elements.append(Paragraph(finding_text, styles['BodyText']))
        elements.append(Spacer(1, 0.1*inch))
    
    elements.append(Spacer(1, 0.2*inch))
    
    # Impression Section
    elements.append(Paragraph("IMPRESSION", heading_style))
    elements.append(Paragraph(report.impression, styles['BodyText']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Recommendations Section
    if report.recommendations:
        elements.append(Paragraph("RECOMMENDATIONS", heading_style))
        for rec in report.recommendations:
            elements.append(Paragraph(f"• {rec}", styles['BodyText']))
        elements.append(Spacer(1, 0.2*inch))
    
    # Signature
    sig_style = ParagraphStyle(
        'Signature',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=6,
        alignment=2  # Right align
    )
    elements.append(Spacer(1, 0.4*inch))
    elements.append(Paragraph(f"Radiologist: {report.radiologist_name}", sig_style))
    elements.append(Paragraph(f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", sig_style))
    
    # Build PDF
    doc.build(elements)
    
    return filename