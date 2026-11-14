import json, re, sys
from pathlib import Path
ROOT = Path(sys.argv[1])
dist = ROOT / 'web/lyco-music-pwa/dist'
errors = []
required = ['index.html','app.js','sw.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png']
for rel in required:
    p = dist / rel
    if not p.is_file() or p.stat().st_size == 0: errors.append('missing/empty '+rel)
html = (dist/'index.html').read_text(encoding='utf-8')
for marker in ['<meta name="viewport"','/lyco-music/app.js','/lyco-music/manifest.webmanifest','data-i18n="pwa.title"','id="pwa-langs"']:
    if marker not in html: errors.append('html missing '+marker)
js = (dist/'app.js').read_text(encoding='utf-8')
if 'lxmn.pwa.locale' not in js or 'mobile.search.total' not in js: errors.append('app.js i18n markers missing')
mf = json.loads((dist/'manifest.webmanifest').read_text(encoding='utf-8'))
if mf.get('start_url') != '/lyco-music/' or mf.get('display') != 'standalone' or len(mf.get('icons',[])) != 3: errors.append('manifest invalid')
for icon in mf.get('icons',[]):
    p = dist / icon['src'].replace('/lyco-music/','')
    if not p.is_file(): errors.append('manifest icon missing '+icon['src'])
    head = p.read_bytes()[:8]
    if head != b'\x89PNG\r\n\x1a\n': errors.append('bad png '+icon['src'])
sw = (dist/'sw.js').read_text(encoding='utf-8')
if ('lyco-pwa-' + json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']) not in sw or '/lyco-music/sw.js' not in js: errors.append('sw/version marker missing')
for rel in ['src/copy.ts','src/app.ts','index.template.html','manifest.webmanifest','sw.js','README.md']:
    if not (ROOT/'web/lyco-music-pwa'/rel).is_file(): errors.append('source missing '+rel)
if errors:
    print('PWA CHECK FAILED'); print('\n'.join(errors)); raise SystemExit(1)
print('PWA CHECK OK: 7 dist artifacts, manifest, icons, i18n and SW markers verified')
