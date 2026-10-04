from pydantic import BaseModel, Field
from typing import Optional
from groq import Groq
from dotenv import load_dotenv
import os
import json
import io
import base64
from PIL import Image as PILImage
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
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
    scan_image: Optional[str] = Field(default=None, description="Optional scan result image data URL or path")
    scan_image_name: Optional[str] = Field(default=None, description="Original filename of scan image")

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

_FONT_INITIALIZED = False
_PDF_FONT_REGULAR = "Helvetica"
_PDF_FONT_BOLD = "Helvetica-Bold"

def _get_pdf_fonts() -> tuple[str, str]:
    """Register TrueType Unicode fonts for clean PDF rendering without missing glyph black blocks."""
    global _FONT_INITIALIZED, _PDF_FONT_REGULAR, _PDF_FONT_BOLD
    if _FONT_INITIALIZED:
        return _PDF_FONT_REGULAR, _PDF_FONT_BOLD

    candidate_pairs = [
        # Liberation Sans (standard on Fedora, RHEL, CentOS, Debian, Ubuntu)
        ('/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf',
         '/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf'),
        ('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
         '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'),
        ('/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
         '/usr/share/fonts/liberation/LiberationSans-Bold.ttf'),
        # DejaVu Sans
        ('/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf',
         '/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf'),
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
        ('/usr/share/fonts/dejavu/DejaVuSans.ttf',
         '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'),
    ]

    for reg_path, bld_path in candidate_pairs:
        if os.path.exists(reg_path):
            try:
                pdfmetrics.registerFont(TTFont('RadiologySans', reg_path))
                if os.path.exists(bld_path):
                    pdfmetrics.registerFont(TTFont('RadiologySans-Bold', bld_path))
                else:
                    pdfmetrics.registerFont(TTFont('RadiologySans-Bold', reg_path))
                _PDF_FONT_REGULAR = 'RadiologySans'
                _PDF_FONT_BOLD = 'RadiologySans-Bold'
                break
            except Exception:
                pass

    _FONT_INITIALIZED = True
    return _PDF_FONT_REGULAR, _PDF_FONT_BOLD


def sanitize_pdf_text(text: Optional[str]) -> str:
    """
    Sanitize text for ReportLab PDF generation:
    - Normalizes unicode hyphens, dashes, and spaces that cause black blocks (tofu/cid:127).
    - Cleans up smart quotes, ellipsis, and special symbols.
    - Safely XML-escapes text for ReportLab Paragraph elements.
    """
    if text is None:
        return ""
    text = str(text)

    # 1. Normalize unicode hyphens and dashes to standard ASCII
    text = text.replace('\u2011', '-')  # Non-breaking hyphen (primary cause of black blocks)
    text = text.replace('\u2010', '-')  # Hyphen
    text = text.replace('\u2012', '-')  # Figure dash
    text = text.replace('\u2013', '-')  # En-dash
    text = text.replace('\u2014', ' - ') # Em-dash
    text = text.replace('\u2015', ' - ') # Horizontal bar
    text = text.replace('\u2212', '-')  # Minus sign

    # 2. Normalize smart quotes and apostrophes
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    text = text.replace('\u201a', "'").replace('\u201b', "'")
    text = text.replace('\u201c', '"').replace('\u201d', '"')
    text = text.replace('\u201e', '"').replace('\u201f', '"')
    text = text.replace('\u00ab', '"').replace('\u00bb', '"')

    # 3. Normalize spaces and zero-width characters
    text = text.replace('\u00a0', ' ')  # Non-breaking space
    text = text.replace('\u202f', ' ')  # Narrow no-break space
    text = text.replace('\u2009', ' ')  # Thin space
    text = text.replace('\u200a', ' ')  # Hair space
    text = text.replace('\u200b', '')   # Zero-width space
    text = text.replace('\u200c', '')   # Zero-width non-joiner
    text = text.replace('\u200d', '')   # Zero-width joiner
    text = text.replace('\ufeff', '')   # Byte order mark

    # 4. Normalize other common symbols and strip raw bullet glyphs
    text = text.replace('\u2026', '...') # Ellipsis
    text = text.replace('\u00b1', '+/-') # Plus-minus
    text = text.replace('\u00d7', 'x')   # Multiplication sign
    text = text.replace('\u2264', '<=')  # Less than or equal
    text = text.replace('\u2265', '>=')  # Greater than or equal
    text = text.replace('\u2022', '')    # Strip existing bullet char if present
    text = text.replace('\u2023', '')    # Strip triangular bullet
    text = text.replace('\u25e6', '')    # Strip white bullet

    # 5. Filter out unprintable control characters (except newline, tab)
    text = "".join(ch for ch in text if ord(ch) >= 32 or ch in ('\n', '\t'))

    # 6. Escape XML special characters so ReportLab Paragraph won't fail
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')

    return text.strip()


def report_to_pdf(report: RadiologyReport, filename: str = None) -> str:
    """
    Convert a RadiologyReport to a clean PDF file with proper Unicode font support.
    
    Args:
        report: RadiologyReport object
        filename: Output filename (optional, generates one if not provided)
        
    Returns:
        str: Path to the generated PDF file
    """
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"radiology_report_{report.patient_id}_{timestamp}.pdf"
    
    font_regular, font_bold = _get_pdf_fonts()

    # Create PDF document
    doc = SimpleDocTemplate(filename, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles with Unicode-safe font
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName=font_bold,
        fontSize=16,
        textColor=colors.HexColor('#1f4788'),
        spaceAfter=12,
        alignment=1  # Center
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontName=font_bold,
        fontSize=12,
        textColor=colors.HexColor('#1f4788'),
        spaceAfter=6,
        spaceBefore=6
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontName=font_regular,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#222222')
    )

    rec_style = ParagraphStyle(
        'CustomRecommendation',
        parent=styles['BodyText'],
        fontName=font_regular,
        fontSize=10,
        leading=14,
        leftIndent=15,
        textColor=colors.HexColor('#222222')
    )

    table_label_style = ParagraphStyle(
        'TableLabel',
        parent=styles['Normal'],
        fontName=font_bold,
        fontSize=10,
        textColor=colors.black
    )

    table_val_style = ParagraphStyle(
        'TableVal',
        parent=styles['Normal'],
        fontName=font_regular,
        fontSize=10,
        textColor=colors.black
    )

    sig_style = ParagraphStyle(
        'Signature',
        parent=styles['Normal'],
        fontName=font_regular,
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=6,
        alignment=2  # Right align
    )
    
    # Title
    elements.append(Paragraph("RADIOLOGY REPORT", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Patient Information Table
    patient_data = [
        [Paragraph("Patient Name", table_label_style), Paragraph(sanitize_pdf_text(report.patient_name), table_val_style)],
        [Paragraph("Patient ID", table_label_style), Paragraph(sanitize_pdf_text(report.patient_id), table_val_style)],
        [Paragraph("Study Date", table_label_style), Paragraph(sanitize_pdf_text(report.study_date), table_val_style)],
        [Paragraph("Modality", table_label_style), Paragraph(sanitize_pdf_text(report.modality), table_val_style)],
        [Paragraph("Study Type", table_label_style), Paragraph(sanitize_pdf_text(report.study_type), table_val_style)],
    ]
    
    patient_table = Table(patient_data, colWidths=[2*inch, 4.2*inch])
    patient_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e8f0f7')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cccccc')),
    ]))
    
    elements.append(patient_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Findings Section
    elements.append(Paragraph("FINDINGS", heading_style))
    for i, finding in enumerate(report.findings, 1):
        loc = sanitize_pdf_text(finding.location)
        sev = sanitize_pdf_text(finding.severity.upper())
        desc = sanitize_pdf_text(finding.description)
        finding_text = f"<b>{i}. {loc}</b> ({sev})<br/>{desc}"
        elements.append(Paragraph(finding_text, body_style))
        elements.append(Spacer(1, 0.1*inch))
    
    elements.append(Spacer(1, 0.2*inch))
    
    # Impression Section
    elements.append(Paragraph("IMPRESSION", heading_style))
    elements.append(Paragraph(sanitize_pdf_text(report.impression), body_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Recommendations Section
    if report.recommendations:
        elements.append(Paragraph("RECOMMENDATIONS", heading_style))
        for rec in report.recommendations:
            clean_rec = sanitize_pdf_text(rec)
            if clean_rec:
                elements.append(Paragraph(f"&bull;&nbsp;&nbsp;{clean_rec}", rec_style))
                elements.append(Spacer(1, 0.05*inch))
        elements.append(Spacer(1, 0.2*inch))
    
    # Signature
    elements.append(Spacer(1, 0.3*inch))
    rad_name = sanitize_pdf_text(report.radiologist_name or "Dr. System")
    elements.append(Paragraph(f"Radiologist: {rad_name}", sig_style))
    elements.append(Paragraph(f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", sig_style))
    
    # Build PDF
    doc.build(elements)
    
    return filename