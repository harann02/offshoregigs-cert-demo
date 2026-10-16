"""FAKE image replicating a decorative 'Presents This Certificate To' OPITO layout
(script heading, long course name instead of the acronym, 'Label :D Mon YYYY' dates,
expired). No real data. Usage: python3 tools/make_gtsc_like.py"""
from PIL import Image, ImageDraw, ImageFont
F = '/usr/share/fonts/truetype/dejavu/'
def font(name, size):
    try: return ImageFont.truetype(F + name, size)
    except OSError: return ImageFont.load_default()
ITALIC = '/usr/share/fonts/truetype/sand-box/google/Noto Serif/NotoSerif-Italic-VariableFont_wdth,wght.ttf'
W, H = 896, 630
im = Image.new('RGB', (W, H), (252, 249, 242)); d = ImageDraw.Draw(im)
for i, c in enumerate([(176, 141, 87), (214, 190, 140)]):
    d.rectangle([20 + i * 10, 20 + i * 10, W - 21 - i * 10, H - 21 - i * 10], outline=c, width=3)
d.pieslice([-260, -420, W + 260, 200], 0, 180, fill=(236, 226, 205))  # decorative swoosh
d.ellipse([60, 40, 170, 150], fill=(150, 120, 80)); d.text((88, 85), 'DEMO', fill=(250, 240, 220), font=font('DejaVuSans-Bold.ttf', 18))
def centre(y, text, f, fill=(20, 20, 20)):
    w = d.textlength(text, font=f); d.text(((W - w) / 2, y), text, fill=fill, font=f)
centre(110, 'DEMO SAFETY', font('DejaVuSans-Bold.ttf', 30))
centre(190, 'Presents This Certificate', ImageFont.truetype(ITALIC, 34), (70, 70, 70))
centre(228, 'To', ImageFont.truetype(ITALIC, 28), (70, 70, 70))
centre(262, 'AHMAD DEMO SAMPLE', font('DejaVuSans-Bold.ttf', 20))
centre(298, 'Who has completed a three day(s) course', font('DejaVuSans.ttf', 14))
centre(320, 'in', font('DejaVuSans.ttf', 14))
centre(345, 'TROPICAL BASIC OFFSHORE SAFETY INDUCTION &', font('DejaVuSans-Bold.ttf', 17))
centre(367, 'EMERGENCY TRAINING', font('DejaVuSans-Bold.ttf', 17))
centre(389, '(Course Code:5501)', font('DejaVuSans-Bold.ttf', 17))
lab, val = font('DejaVuSerif.ttf', 13), font('DejaVuSans-Bold.ttf', 12)
for y, l, v in [(465, 'Certificate No. :', 'DEMO55010000000000123'), (497, 'Date of Issue', ':16 Sep 2015'), (527, 'Date of Expiry', ':15 Sep 2019')]:
    d.text((95, y), l, fill=(60, 60, 60), font=lab); d.text((212, y), v, fill=(10, 10, 10), font=val)
d.ellipse([400, 440, 480, 520], fill=(40, 120, 170)); d.text((415, 472), 'OPITO', fill='white', font=font('DejaVuSans-Bold.ttf', 14))
d.line([600, 465, 760, 455], fill=(30, 30, 30), width=2); d.line([590, 505, 740, 505], fill=(30, 30, 30), width=1)
d.text((600, 512), 'Authorized Signatory', fill=(40, 40, 40), font=font('DejaVuSerif-Bold.ttf', 12))
centre(585, 'www.demo-safety.example', font('DejaVuSerif-Bold.ttf', 13))
d.text((60, 560), 'FAKE SAMPLE FOR TESTING ONLY - NOT A REAL CERTIFICATE', fill=(200, 0, 0), font=font('DejaVuSans.ttf', 10))
im.save('samples/sample-gtsc-style-expired-FAKE.png')
