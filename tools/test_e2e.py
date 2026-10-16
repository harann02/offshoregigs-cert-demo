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
    href = pg.get_attribute('#result .opito-btn', 'href')
    res['opito'] = {'href': href, 'target': pg.get_attribute('#result .opito-btn', 'target'), 'note': pg.inner_text('#result .opito-note'),
        'ok': href == 'https://www.thehubopito.com/public/validate?Surname=SAMPLE&Ref=DEMO-BOS-000123' and pg.get_attribute('#result .opito-btn', 'target') == '_blank'
              and pg.locator('#result .copy-btn').count() == 1 and pg.inner_text('#result .opito-note') == 'Tick "I\'m not a robot" and press Validate on the OPITO page.'}
    shot('14_verify_opito.png')
    pg.click('#confirmBtn'); pg.wait_for_selector('.item')
    res['opito']['list_href'] = pg.get_attribute('.item .opito-btn', 'href')
    res['opito']['ok'] = res['opito']['ok'] and res['opito']['list_href'] == href
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
    res['multiple'] = {'text': t, 'ok': 'Multiple certificates detected' in t and pg.locator('#confirmBtn').count() == 0 and pg.locator('#submitBtn').count() == 0}
    pg.click('#cancelBtn')
    t = upload(S / 'sample-duplicate-2page-FAKE.pdf'); shot('05b_duplicate_2page.png')
    res['duplicate'] = {'text': t, 'ok': 'Category\n5700 - BOSIET WITH EBS' in t and 'DEMO-BOS-000123' in t and 'Multiple' not in t and pg.locator('#confirmBtn').count() == 1}
    pg.click('#cancelBtn')
    t = upload(S / 'sample-front-back-FAKE.pdf'); shot('05c_front_back.png')
    res['front_back'] = {'text': t, 'ok': all(s in t for s in ['Category\nWORKING AT HEIGHT (WAH) BASIC', 'AHMAD DEMO SAMPLE', 'WAH 23-01-2025-9', '23/01/2025', '23/01/2028']) and 'Multiple' not in t and pg.locator('#confirmBtn').count() == 1}
    pg.click('#cancelBtn')
    t = upload(S / 'sample-quotation-FAKE.pdf'); shot('05d_quotation.png')
    res['quotation'] = {'text': t, 'ok': "We couldn't match this document" in t and 'We detected' not in t and "doesn't look like a certificate" in t
        and pg.locator('#confirmBtn').count() == 0 and pg.locator('#submitBtn').count() == 1}
    pg.click('#cancelBtn')
    # Unknown flow: pick an existing category
    t = upload(S / 'sample-unknown-FAKE.pdf')
    dis = pg.is_disabled('#submitBtn')
    pg.fill('#catSearch', 'first aid'); vis = pg.evaluate("[...document.querySelectorAll('#catSelect option')].filter(o=>!o.hidden).map(o=>o.value)")
    pg.select_option('#catSelect', 'BASIC FIRST AID'); shot('15_unknown_manual.png')
    res['unknown_existing'] = {'text': t, 'ok': "We couldn't match this document" in t and 'clearer copy' not in t and 'Not found' in t and dis and not pg.is_disabled('#submitBtn')
        and 'BASIC FIRST AID' in vis and '5501 - T BOSIET' not in vis and '__other' in vis and pg.locator('#confirmBtn').count() == 0 and pg.locator('#cancelBtn').count() == 1}
    pg.click('#submitBtn'); pg.wait_for_selector('.item:has-text("BASIC FIRST AID")')
    res['unknown_existing']['chip'] = pg.inner_text('.item >> nth=0')
    res['unknown_existing']['ok'] &= 'Pending approval' in res['unknown_existing']['chip']
    # Not in list: Other -> typed new category
    t = upload(S / 'sample-irata-not-listed-FAKE.pdf')
    pg.select_option('#catSelect', '__other'); d1 = pg.is_disabled('#submitBtn'); vis_other = pg.is_visible('#otherName')
    pg.fill('#otherName', 'IRATA Rope Access Technician Level 1')
    res['other_new'] = {'text': t, 'ok': "We couldn't match this document" in t and 'IRATA Rope Access Technician Level 1' in t and 'Request to add' not in t and d1 and vis_other and not pg.is_disabled('#submitBtn')}
    pg.click('#submitBtn'); pg.wait_for_selector('.item:has-text("IRATA")'); shot('16_pending.png')
    res['other_new']['chip'] = pg.inner_text('.item >> nth=0')
    res['other_new']['ok'] &= 'Pending approval' in res['other_new']['chip']
    res['requests'] = pg.evaluate("JSON.parse(localStorage.getItem('offshoregigs-category-requests'))")
    ad = pg.context.new_page()
    ad.set_viewport_size({'width': 390, 'height': 844}); ad.goto(URL.rstrip('/') + '/admin.html'); ad.wait_for_selector('tr[data-id]')
    ad.screenshot(path=str(OUT / '17_admin_review.png'), full_page=True)
    rows = ad.inner_text('tbody')
    res['admin_rows'] = {'text': rows, 'ok': all(x in rows for x in ['sample-irata-not-listed-FAKE.pdf', 'sample-unknown-FAKE.pdf', 'IRATA Rope Access Technician Level 1', 'BASIC FIRST AID', 'Yes (new)', 'No (existing)', 'Pending', 'Name:'])}
    ad.click('tr:has-text("IRATA") button.a'); ad.wait_for_selector('tr:has-text("IRATA") td.Approved')
    ad.click('tr:has-text("BASIC FIRST AID") button.r'); ad.wait_for_selector('tr:has-text("BASIC FIRST AID") td.Rejected')
    ad.click('summary'); ad.screenshot(path=str(OUT / '17b_admin_decided.png'), full_page=True)
    res['admin'] = {'added': ad.evaluate("localStorage.getItem('offshoregigs-categories-added')")}
    ad.close()
    pg.reload(); pg.wait_for_selector('.item')
    li = pg.inner_text('#list'); shot('18_list_decided.png')
    irata = pg.inner_text('.item:has-text("IRATA")'); bfa = pg.inner_text('.item:has-text("BASIC FIRST AID")')
    res['decisions'] = {'ok': 'Approved by admin' in irata and 'Rejected' in bfa and 'IRATA Rope Access Technician Level 1' in (res['admin']['added'] or '')
        and pg.locator('.item .chip.green:has-text("Approved by admin")').count() == 1 and pg.locator('.item .chip.red:has-text("Rejected")').count() == 1}
    t = upload(S / 'sample-irata-not-listed-FAKE.pdf'); shot('12_after_approve.png')
    res['after_approve'] = {'text': t, 'ok': 'Category\nIRATA Rope Access Technician Level 1' in t and pg.locator('#confirmBtn').count() == 1 and pg.locator('#result .opito-btn').count() == 0}
    pg.click('#cancelBtn'); pg.reload(); pg.wait_for_selector('.item')
    res['persist_after_reload'] = pg.locator('.item').count()
    pg.click('#refreshBtn'); res['last_checked'] = pg.inner_text('#lastChecked')
    shot('07_list.png')
    body = pg.inner_text('body'); store = pg.evaluate("localStorage.getItem('offshoregigs-certificates')")
    res['no_provider'] = {'ok': 'provider' not in body.lower() and 'provider' not in store.lower()}
    shot('13_no_provider.png')
    # ---- name cross-check against the demo profile ----
    res['profile_default'] = pg.inner_text('#profileStrip')
    pg.once('dialog', lambda d: d.accept('Ahmad Sample'))
    pg.click('#profileEdit'); prof1 = pg.inner_text('#profileName')
    t = upload(sample=True); shot('19_name_match.png')
    res['name_match'] = {'text': t, 'profile': prof1, 'ok': prof1 == 'Ahmad Sample' and 'Name matches your profile' in t
        and pg.locator('#confirmBtn:not([disabled])').count() == 1 and pg.locator('#submitBtn').count() == 0}
    pg.click('#cancelBtn')
    pg.evaluate("localStorage.setItem('offshoregigs-demo-profile-name','Ahmad Ali')"); pg.reload(); pg.wait_for_selector('.item')
    t = upload(sample=True); shot('20_name_partial.png')
    res['name_partial'] = {'text': t, 'ok': 'Name may not match your profile: AHMAD DEMO SAMPLE vs Ahmad Ali' in t
        and pg.is_disabled('#confirmBtn') and pg.locator('#submitBtn:not([disabled])').count() == 1}
    pg.click('#submitBtn'); pg.wait_for_selector('.item:has-text("Pending approval")')
    pg.evaluate("localStorage.setItem('offshoregigs-demo-profile-name','Lim Wei Jie')"); pg.reload(); pg.wait_for_selector('.item')
    t = upload(sample=True); shot('21_name_mismatch.png')
    res['name_mismatch'] = {'text': t, 'ok': "This certificate is in someone else's name. You can only upload your own certificates." in t
        and pg.locator('#confirmBtn').count() == 0 and pg.locator('#submitBtn').count() == 0 and pg.locator('#cancelBtn').count() == 1}
    pg.click('#cancelBtn')
    # Manual-category flow: FAKE unmatched result with another person's name (profile Lim Wei Jie)
    fake = "({status:'unknown', name:'%s', filename:'manual-FAKE.pdf', core_fields:1, certificate_number:null, issue_date:null, expiry_date:null})"
    pg.evaluate("renderResult" + fake % 'AHMAD DEMO SAMPLE'); t = pg.inner_text('#result')
    res['manual_mismatch'] = {'text': t, 'ok': "someone else's name" in t and pg.locator('#submitBtn').count() == 0 and pg.locator('#cancelBtn').count() == 1}
    pg.click('#cancelBtn')
    pg.evaluate("localStorage.setItem('offshoregigs-demo-profile-name','Ahmad Ali')"); pg.reload(); pg.wait_for_selector('.item')
    pg.evaluate("renderResult" + fake % 'AHMAD DEMO SAMPLE'); t = pg.inner_text('#result')
    pg.select_option('#catSelect', 'BASIC FIRST AID'); okp = 'Name may not match your profile: AHMAD DEMO SAMPLE vs Ahmad Ali' in t and not pg.is_disabled('#submitBtn')
    pg.click('#submitBtn'); pg.wait_for_selector('.item:has-text("BASIC FIRST AID")')
    res['manual_partial'] = {'ok': okp}
    t = upload(S / 'sample-unknown-FAKE.pdf'); pg.select_option('#catSelect', 'BASIC H2S')
    res['manual_not_found'] = {'ok': 'could not find a name' in t and not pg.is_disabled('#submitBtn')}
    pg.click('#submitBtn'); pg.wait_for_selector('.item:has-text("BASIC H2S")')
    pg.evaluate("localStorage.removeItem('offshoregigs-demo-profile-name')")
    ad = pg.context.new_page(); ad.set_viewport_size({'width': 390, 'height': 844}); ad.goto(URL.rstrip('/') + '/admin.html'); ad.wait_for_selector('tr[data-id]')
    rows = ad.inner_text('tbody'); ad.screenshot(path=str(OUT / '22_admin_name_reason.png'), full_page=True)
    r0, r1, r2 = [ad.inner_text('tbody tr >> nth=%d' % i) for i in range(3)]
    res['admin_name_reason'] = {'rows': ' || '.join([r0, r1, r2]), 'ok': 'name not found' in r0 and 'BASIC H2S' in r0
        and 'name check' in r1 and 'BASIC FIRST AID' in r1 and 'Certificate name: AHMAD DEMO SAMPLE' in r1 and 'Profile name: Ahmad Ali' in r1
        and 'name check' in r2 and '5700 - BOSIET WITH EBS' in r2 and 'Certificate name: AHMAD DEMO SAMPLE' in r2 and 'Profile name: Ahmad Ali' in r2}
    ad.close()
    b.close()
print(json.dumps(res, indent=1))
