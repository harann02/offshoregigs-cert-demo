"""Headless Chrome test. Usage: python tools/test_e2e.py URL OUTDIR"""
import sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
S = Path(__file__).resolve().parents[1] / 'samples'
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    pg.on('console', lambda m: print('console:', m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_selector('.empty')
    shot = lambda n: pg.screenshot(path=str(OUT / n), full_page=True)
    def upload(path=None, sample=False, wait_reading=False):
        if sample: pg.click('#sampleLink'); pg.wait_for_selector('#fileBox.has')
        else: pg.set_input_files('#file', str(path))
        pg.click('#uploadBtn')
        if wait_reading:
            pg.wait_for_selector('#reading:not([hidden])'); shot('02_reading.png')
        pg.wait_for_selector('#result:not([hidden])', timeout=240000)
        return pg.inner_text('#result')
    pg.click('#sampleLink'); pg.wait_for_selector('#fileBox.has'); shot('01_upload.png')
    pg.click('#uploadBtn'); pg.wait_for_selector('#result:not([hidden])', timeout=120000)
    t = pg.inner_text('#result'); shot('03_detected_pdf.png')
    res['pdf'] = {'text': t, 'ok': all(s in t for s in ['We detected: BOSIET', 'AHMAD DEMO SAMPLE', 'DEMO-BOS-000123', '12/03/2025', '12/03/2029', 'Demo Survival Training Centre Sdn Bhd']) and pg.locator('#confirmBtn').count() == 1}
    pg.click('#confirmBtn'); pg.wait_for_selector('.item')
    res['confirm'] = {'items': pg.locator('.item').count(), 'stored': pg.evaluate("JSON.parse(localStorage.getItem('offshoregigs-certificates')).length"), 'chip': pg.inner_text('.item .chips')}
    t = upload(S / 'sample-bosiet-FAKE.png', wait_reading=True); shot('04_detected_png.png')
    res['png'] = {'text': t, 'ocr': pg.evaluate('window.lastScan.pages[0]'), 'ok': 'We detected: BOSIET' in t and pg.locator('#confirmBtn').count() == 1}
    pg.click('#confirmBtn'); pg.wait_for_selector('.item >> nth=1')
    t = upload(S / 'sample-tropical-bosiet-caebs-FAKE.pdf'); shot('04b_tropical_bosiet.png')
    res['tropical'] = {'text': t, 'ok': all(s in t for s in ['We detected: BOSIET', 'AHMAD DEMO SAMPLE', '000000DEMO000123', '12/03/2025', '11/03/2029']) and pg.locator('#confirmBtn').count() == 1}
    pg.click('#cancelBtn')
    t = upload(S / 'sample-multiple-FAKE.pdf'); shot('05_multiple_warning.png')
    res['multiple'] = {'text': t, 'ok': 'Multiple certificates detected' in t and pg.locator('#confirmBtn').count() == 0}
    pg.click('#cancelBtn')
    t = upload(S / 'sample-unknown-FAKE.pdf'); shot('06_unknown.png')
    res['unknown'] = {'text': t, 'ok': 'clearer copy' in t and pg.locator('#confirmBtn').count() == 0}
    pg.click('#cancelBtn'); pg.reload(); pg.wait_for_selector('.item')
    res['persist_after_reload'] = pg.locator('.item').count()
    pg.click('#refreshBtn'); res['last_checked'] = pg.inner_text('#lastChecked')
    shot('07_list.png')
    b.close()
print(json.dumps(res, indent=1))
