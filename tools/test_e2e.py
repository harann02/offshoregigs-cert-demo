"""Headless Chrome test. Usage: python tools/test_e2e.py URL OUTDIR"""
import sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
S = Path(__file__).resolve().parents[1] / 'samples'
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2); pg = ctx.new_page()
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
    res['pdf'] = {'text': t, 'ok': all(s in t for s in ['Category\n5700 - BOSIET WITH EBS', 'AHMAD DEMO SAMPLE', 'DEMO-BOS-000123', '12/03/2025', '12/03/2029']) and 'Provider' not in t and 'Demo Survival Training Centre' not in t and pg.locator('#confirmBtn').count() == 1}
    pg.click('#confirmBtn'); pg.wait_for_selector('.item')
    res['confirm'] = {'items': pg.locator('.item').count(), 'stored': pg.evaluate("JSON.parse(localStorage.getItem('offshoregigs-certificates')).length"), 'chip': pg.inner_text('.item .chips')}
    t = upload(S / 'sample-bosiet-FAKE.png', wait_reading=True); shot('04_detected_png.png')
    res['png'] = {'text': t, 'ocr': pg.evaluate('window.lastScan.pages[0]'), 'ok': '5700 - BOSIET WITH EBS' in t and pg.locator('#confirmBtn').count() == 1}
    pg.click('#confirmBtn'); pg.wait_for_selector('.item >> nth=1')
    t = upload(S / 'sample-gtsc-style-expired-FAKE.png'); shot('04a_gtsc_style_expired.png')
    res['gtsc_style'] = {'text': t, 'ok': all(s in t for s in ['Category\n5501 - T BOSIET', 'AHMAD DEMO SAMPLE', '16/09/2015', 'Expired on 15/09/2019']) and pg.locator('#confirmBtn').count() == 1}
    pg.click('#confirmBtn'); pg.wait_for_selector('.item >> nth=2')
    res['gtsc_style']['chip'] = pg.inner_text('.item .chips')
    t = upload(S / 'sample-tropical-bosiet-caebs-FAKE.pdf'); shot('04b_tropical_bosiet.png')
    res['tropical'] = {'text': t, 'ok': all(s in t for s in ['Category\n5509 - T BOSIET WITH CAEBS & TSBB', 'AHMAD DEMO SAMPLE', '000000DEMO000123', '12/03/2025', '11/03/2029']) and pg.locator('#confirmBtn').count() == 1}
    pg.click('#cancelBtn')
    t = upload(S / 'sample-multiple-FAKE.pdf'); shot('05_multiple_warning.png')
    res['multiple'] = {'text': t, 'ok': 'Multiple certificates detected' in t and pg.locator('#confirmBtn').count() == 0}
    pg.click('#cancelBtn')
    t = upload(S / 'sample-unknown-FAKE.pdf'); shot('06_unknown.png')
    res['unknown'] = {'text': t, 'ok': 'clearer copy' in t and pg.locator('#confirmBtn').count() == 0}
    pg.click('#cancelBtn')
    t = upload(S / 'sample-irata-not-listed-FAKE.pdf'); shot('08_not_in_list.png')
    ok = "This certificate isn't in our list yet" in t and 'IRATA Rope Access Technician Level 1' in t and pg.locator('#confirmBtn').count() == 0
    pg.click('#requestBtn'); pg.wait_for_selector('#reqSent:not([hidden])'); shot('09_request_sent.png')
    res['not_listed'] = {'text': t, 'ok': ok and 'Request sent - our team will review it' in pg.inner_text('#result'),
        'stored': pg.evaluate("JSON.parse(localStorage.getItem('offshoregigs-category-requests'))")}
    pg.click('#cancelBtn')
    ad = pg.context.new_page()
    ad.set_viewport_size({'width': 900, 'height': 700}); ad.goto(URL.rstrip('/') + '/admin.html'); ad.wait_for_selector('tr[data-id]')
    ad.screenshot(path=str(OUT / '10_admin_pending.png'), full_page=True)
    ad.click('button.a'); ad.wait_for_selector('td.Approved'); ad.click('summary')
    ad.screenshot(path=str(OUT / '11_admin_approved.png'), full_page=True)
    res['admin'] = {'title': ad.title(), 'row': ad.inner_text('tbody'), 'added': ad.evaluate("localStorage.getItem('offshoregigs-categories-added')")}
    ad.close()
    t = upload(S / 'sample-irata-not-listed-FAKE.pdf'); shot('12_after_approve.png')
    res['after_approve'] = {'text': t, 'ok': 'Category\nIRATA Rope Access Technician Level 1' in t and pg.locator('#confirmBtn').count() == 1}
    pg.click('#cancelBtn'); pg.reload(); pg.wait_for_selector('.item')
    res['persist_after_reload'] = pg.locator('.item').count()
    pg.click('#refreshBtn'); res['last_checked'] = pg.inner_text('#lastChecked')
    shot('07_list.png')
    body = pg.inner_text('body'); store = pg.evaluate("localStorage.getItem('offshoregigs-certificates')")
    res['no_provider'] = {'ok': 'provider' not in body.lower() and 'provider' not in store.lower()}
    shot('13_no_provider.png')
    b.close()
print(json.dumps(res, indent=1))
