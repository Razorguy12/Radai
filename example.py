#!/usr/bin/env python3
"""
Example script demonstrating radiology report generation and PDF conversion.
Run this to test the system locally.
"""

from dotenv import load_dotenv
import model.model as model

# Load environment variables
load_dotenv()

def main():
    print("=" * 60)
    print("RADIOLOGY REPORT GENERATOR - Example")
    print("=" * 60)
    
    # Example 1: Basic chest X-ray
    print("\n[Example 1] Generating Chest X-ray Report...")
    
    patient_info = """
    Patient Name: John Doe
    Patient ID: PAT-2024-0001
    Age: 55
    Gender: Male
    """
    
    study_info = """
    Study Date: 2024-06-02
    Modality: Chest X-ray
    Study Type: PA and Lateral views
    """
    
    clinical_info = """
    Chief Complaint: Persistent cough for 2 weeks
    Clinical History: Patient presents with dry cough, mild dyspnea.
    No fever or hemoptysis.
    """
    
    combined_input = f"""
    Patient Information: {patient_info}
    Study Information: {study_info}
    Clinical Information: {clinical_info}
    """
    
    try:
        # Generate report
        report = model.generate_report(combined_input)
        print("\n✓ Report generated successfully!")
        print(f"  Patient: {report.patient_name}")
        print(f"  Study: {report.study_type}")
        print(f"  Modality: {report.modality}")
        print(f"  Findings: {len(report.findings)} finding(s)")
        
        # Convert to PDF
        pdf_path = model.report_to_pdf(report)
        print(f"✓ PDF saved to: {pdf_path}")
        
    except Exception as e:
        print(f"✗ Error: {e}")
    
    # Example 2: CT scan
    print("\n" + "=" * 60)
    print("[Example 2] Generating CT Abdomen Report...")
    
    patient_info2 = """
    Patient Name: Jane Smith
    Patient ID: PAT-2024-0002
    Age: 42
    Gender: Female
    """
    
    study_info2 = """
    Study Date: 2024-06-02
    Modality: CT Abdomen and Pelvis with IV contrast
    Study Type: Diagnostic CT
    """
    
    clinical_info2 = """
    Chief Complaint: Abdominal pain
    Clinical History: Patient with acute abdominal pain, nausea and vomiting.
    Rule out appendicitis.
    """
    
    combined_input2 = f"""
    Patient Information: {patient_info2}
    Study Information: {study_info2}
    Clinical Information: {clinical_info2}
    """
    
    try:
        # Generate report
        report2 = model.generate_report(combined_input2)
        print("\n✓ Report generated successfully!")
        print(f"  Patient: {report2.patient_name}")
        print(f"  Study: {report2.study_type}")
        print(f"  Modality: {report2.modality}")
        print(f"  Findings: {len(report2.findings)} finding(s)")
        
        # Convert to PDF
        pdf_path2 = model.report_to_pdf(report2)
        print(f"✓ PDF saved to: {pdf_path2}")
        
    except Exception as e:
        print(f"✗ Error: {e}")
    
    print("\n" + "=" * 60)
    print("Examples completed!")
    print("\nTo run the FastAPI server, use:")
    print("  python -m uvicorn main:app --reload")
    print("\nThen visit: http://localhost:8000/docs")
    print("=" * 60)

if __name__ == "__main__":
    main()
