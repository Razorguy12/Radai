# Radiology Report Generator

A FastAPI-based system that generates professional radiology reports using Groq's LLM (Qwen 2.5 32B) and converts them to PDF format.

## Features

- **Pydantic Models**: Structured radiology report format with findings, impressions, and recommendations
- **LLM-Powered Generation**: Uses Groq (Qwen 2.5 32B) to generate realistic radiology reports from key information
- **PDF Export**: Converts structured reports to professionally formatted PDF documents
- **FastAPI REST API**: Easy-to-use endpoints for report generation and PDF download

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure API Key

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Groq API key:

```
GROQ_API_KEY=gsk_your-key-here
```

## Project Structure

```
radiology/
├── main.py           # FastAPI application with endpoints
├── model/
│   └── model.py      # Pydantic models, LLM generation, PDF export
├── example.py        # Example usage script
├── requirements.txt  # Python dependencies
├── .env.example      # Environment variable template
└── README.md         # This file
```

## Usage

### Option 1: Command Line Example

```bash
python example.py
```

This runs example radiology reports (chest X-ray and CT scan) and generates PDFs.

### Option 2: FastAPI REST API

Start the server:

```bash
python -m uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

**Interactive API Documentation**: Visit `http://localhost:8000/docs`

#### Endpoints

**1. Health Check**
```
GET /health
```

**2. Generate Report (JSON)**
```
POST /generate-report

Request body:
{
  "patient_info": "Patient Name: John Doe, ID: PAT-001, Age: 55",
  "study_info": "Modality: Chest X-ray, Study: PA and Lateral, Date: 2024-06-02",
  "clinical_info": "Chief complaint: Persistent cough for 2 weeks"
}

Response: RadiologyReport object
```

**3. Generate Report with PDF**
```
POST /generate-report-pdf

Same request body as /generate-report

Response: PDF file download
```

## Report Format

The system generates reports with the following structure:

```
RadiologyReport
├── patient_name: str
├── patient_id: str
├── study_date: str (YYYY-MM-DD)
├── modality: str (CT, MRI, X-ray, Ultrasound, etc.)
├── study_type: str
├── findings: list[RadiologyFinding]
│   ├── location: str
│   ├── description: str
│   └── severity: str (mild, moderate, severe)
├── impression: str
├── recommendations: list[str]
└── radiologist_name: str
```

## Example Usage

### Python

```python
import model.model as model

# Input information
user_input = """
Patient Information: John Doe, ID: PAT-001, Age: 55, Male
Study Information: Chest X-ray, PA and Lateral views, 2024-06-02
Clinical Information: Persistent cough for 2 weeks, no fever
"""

# Generate report
report = model.generate_report(user_input)

# Convert to PDF
pdf_path = model.report_to_pdf(report)
print(f"PDF saved to: {pdf_path}")
```

### cURL

```bash
curl -X POST "http://localhost:8000/generate-report" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_info": "Patient Name: John Doe, ID: PAT-001",
    "study_info": "Modality: Chest X-ray, Date: 2024-06-02",
    "clinical_info": "Chest pain, shortness of breath"
  }'
```

## Dependencies

- **FastAPI**: Web framework
- **Pydantic**: Data validation and serialization
- **Groq**: LLM API for report generation
- **ReportLab**: PDF generation
- **python-dotenv**: Environment variable management
- **Uvicorn**: ASGI server

## Notes

- The system uses Qwen 2.5 32B model from Groq for report generation (update the model name in `model.py` if needed)
- Generated reports are realistic but plausible - use for demonstration and testing only
- PDFs are saved to the current working directory with timestamp-based filenames
- All timestamps in generated reports use UTC

## Customization

### Modify Report Format

Edit the `RadiologyReport` and `RadiologyFinding` Pydantic models in `model/model.py` to change the report structure.

### Customize PDF Styling

Modify the `report_to_pdf()` function in `model/model.py` to change colors, fonts, and layout.

### Change LLM Model

Update the `model` parameter in the `generate_report()` function to use a different Groq model.

## Troubleshooting

**"Missing GROQ_API_KEY"**
- Make sure `.env` file exists with your API key
- Check that the key is valid and has sufficient credits

**"Invalid API Key"**
- Verify the API key in `.env` is correct
- Get a new key from https://console.groq.com/keys

**PDF generation fails**
- Ensure ReportLab is installed: `pip install reportlab`
- Check write permissions in the current directory

