"""Make FAKE sample PDFs (no real data) with a real text layer. Plain Python, no libraries."""
from pathlib import Path

def esc(s): return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

def page_stream(lines):
    out = ['BT']
    y = 760
    for size, text in lines:
        out.append(f'/F1 {size} Tf 1 0 0 1 60 {y} Tm ({esc(text)}) Tj')
        y -= size + 16
    out.append('ET')
    return '\n'.join(out).encode()

def make_pdf(path, pages):
    objs = []
    kids = []
    objs.append(b'<< /Type /Catalog /Pages 2 0 R >>')
    objs.append(None)  # pages placeholder
    objs.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    for lines in pages:
        s = page_stream(lines)
        objs.append(b'<< /Length %d >>\nstream\n' % len(s) + s + b'\nendstream')
        content = len(objs)
        objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content} 0 R >>'.encode())
        kids.append(len(objs))
    objs[1] = f'<< /Type /Pages /Kids [{" ".join(f"{k} 0 R" for k in kids)}] /Count {len(kids)} >>'.encode()
    data = b'%PDF-1.4\n'
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(data))
        data += f'{i} 0 obj\n'.encode() + o + b'\nendobj\n'
    xref = len(data)
    data += f'xref\n0 {len(objs)+1}\n0000000000 65535 f \n'.encode()
    data += b''.join(f'{o:010d} 00000 n \n'.encode() for o in offsets)
    data += f'trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    Path(path).write_bytes(data)

BOSIET = [
    (13, 'Demo Survival Training Centre Sdn Bhd'),
    (26, 'BOSIET'),
    (14, 'Basic Offshore Safety Induction and Emergency Training with EBS'),
    (12, 'OPITO Course Code: 5700'),
    (16, 'Certificate of Completion'),
    (14, 'Name: AHMAD DEMO SAMPLE'),
    (14, 'Certificate No: DEMO-BOS-000123'),
    (14, 'Date of Issue: 12/03/2025'),
    (14, 'Expiry Date: 12/03/2029'),
    (14, 'Training Provider: Demo Survival Training Centre Sdn Bhd'),
    (11, 'FAKE SAMPLE FOR TESTING ONLY - NOT A REAL CERTIFICATE'),
]
MEDICAL = [
    (13, 'Demo Offshore Clinic Sdn Bhd'),
    (24, 'Offshore Medical'),
    (16, 'Certificate of Fitness'),
    (14, 'Name: SITI DEMO EXAMPLE'),
    (14, 'Certificate No: DEMO-MED-000456'),
    (14, 'Date of Examination: 01/06/2025'),
    (14, 'Valid until: 01/06/2027'),
    (14, 'Fit for offshore work'),
    (11, 'FAKE SAMPLE FOR TESTING ONLY - NOT A REAL CERTIFICATE'),
]
TROPICAL = [
    (12, 'DEMO OFFSHORE SAFETY'),
    (12, 'SDN BHD'),
    (12, 'This is to certify'),
    (16, 'AHMAD DEMO SAMPLE'),
    (12, 'IC/Passport No : 000000-00-0000'),
    (12, 'has been assessed against and met the learning outcomes for'),
    (14, 'Tropical BOSIET with CA-EBS and Travel Safely By Boat'),
    (12, 'Opito Course Code : 0000'),
    (11, 'Covers Helicopter Underwater Escape Training (HUET) with Compressed Air'),
    (11, 'Emergency Breathing System (CA-EBS), Sea Survival and Fire Fighting'),
    (14, 'Training Date : 10 - 12 MARCH 2025'),
    (14, 'This certificate is valid till : 11 MARCH 2029'),
    (14, 'Certificate No : 000000DEMO000123'),
    (11, 'FAKE SAMPLE FOR TESTING ONLY - NOT A REAL CERTIFICATE'),
]
IRATA = [
    (13, 'Demo Rope Access Academy Sdn Bhd'),
    (16, 'Certificate of Competence'),
    (12, 'This is to certify'),
    (16, 'SITI DEMO EXAMPLE'),
    (12, 'has successfully completed'),
    (14, 'IRATA Rope Access Technician Level 1'),
    (14, 'Certificate No: DEMO-IRT-000789'),
    (14, 'Date of Issue: 05/05/2025'),
    (14, 'Expiry Date: 05/05/2028'),
    (11, 'FAKE SAMPLE FOR TESTING ONLY - NOT A REAL CERTIFICATE'),
]
UNKNOWN = [(20, 'Shopping list'), (14, 'Bread, milk, eggs'), (11, 'FAKE SAMPLE FOR TESTING ONLY')]
make_pdf('samples/sample-bosiet-FAKE.pdf', [BOSIET])
make_pdf('samples/sample-multiple-FAKE.pdf', [BOSIET, MEDICAL])
make_pdf('samples/sample-unknown-FAKE.pdf', [UNKNOWN])
make_pdf('samples/sample-tropical-bosiet-caebs-FAKE.pdf', [TROPICAL])
make_pdf('samples/sample-irata-not-listed-FAKE.pdf', [IRATA])
