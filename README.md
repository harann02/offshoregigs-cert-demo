# OffshoreGigs Certificate Upload Demo (static)

Live demo: https://harann02.github.io/offshoregigs-cert-demo/

This is a demo of the OffshoreGigs "Certificates" screen. Everything runs **in your browser**.
No file is sent to any server.

## How to use

1. Open the link on your phone or computer.
2. Tap **Tap to select a file** and choose a PDF, PNG or JPG certificate.
   Or tap **Try a sample** to load a fake BOSIET certificate.
3. Tap **Upload Certificate**. You will see "Reading your certificate...".
4. The app shows **We detected: TYPE** with Name, Certificate No, Issue date
   and Expiry date. You cannot edit these. If something is missing it says "Not found".
5. Tap **Confirm** to add it to your list, or **Cancel / Upload again**.

- If the file has more than one certificate, you get a red warning and no Confirm button.
- If the type is not clear, you are asked to upload a clearer copy.
- Your list is saved in this browser only (localStorage). Expiry chips are green,
  amber (less than 60 days left) or red (expired).

## How it works

- PDF: the text is read with [pdf.js](https://mozilla.github.io/pdf.js/). If a page has no text
  (a scanned PDF), the page is drawn as a picture and read with OCR.
- Images: read with OCR using [tesseract.js](https://tesseract.projects.naptha.com/).
- Both libraries load from the jsDelivr CDN.
- `detect.js` finds the type and the details using keywords and patterns. It is a copy of
  the Python logic (`detect.py`, `fields.py`) from the original demo. Supported types:
  BOSIET, FOET, HUET, Medical, OGUK/OEUK, CA-EBS.

## Files

- `index.html`, `style.css`, `app.js` - the screen
- `detect.js` - type and field detection
- `samples/` - FAKE sample files (no real data). Made with `python3 tools/make_samples.py`
- `tools/test_e2e.py` - browser test (Playwright)

## Limits

- The first OCR (image or scanned PDF) downloads about 10 MB (reader + English language data). It is cached after that.
- OCR can misread letters (for example `0` and `O`). A clear, straight, bright scan works best.
- Dates are read day first (DD/MM/YYYY).
- This is a demo. It checks the wording only. It does **not** prove a certificate is real.
- The list is only in this browser. Clearing browser data removes it.

## Categories and requests (v3)

- The result shows **Category: <name>** from the OffshoreGigs certificate category list in
  `categories.js` (exact names from the OffshoreGigs admin certificate catalogue snapshot,
  51 enabled entries). Matching: OPITO course code (e.g. "Course Code:5501" -> "5501 - T BOSIET"),
  then BOSIET/FOET/CA-EBS variant (Tropical, CA-EBS/EBS, TSBB), then the list name's words.
- Expired certificates are detected and flagged in red ("Expired on DD/MM/YYYY"). Confirm is still
  allowed ("Confirm (expired)") and the list shows a red chip.
- A certificate that is not in the list shows "This certificate isn't in our list yet" with the
  detected title and a **Submit for approval** button.
- `admin.html` (OffshoreGigs Admin - Category requests) lists the requests with Approve/Reject.
  Approve adds the title to the list, so later uploads match it.
- **Demo only:** requests and added categories live in this browser's localStorage (same browser
  only). The real app needs a backend table for requests and categories.
- Images are upscaled, greyscaled and contrast-stretched before OCR, and read with automatic page
  layout (PSM 3), then sparse text (PSM 11) and the original image if fields are missing.
- Tests: `node tools/test_detect.js` and `python3 tools/test_e2e.py URL OUTDIR`.
