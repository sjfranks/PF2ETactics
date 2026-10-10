import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
order = ['core','data_rules','data_classes','data_spells','data_spells_auto','data_bestiary','data_mc','data_maps','builder','engine','actions','ai','models','gfx','render3d','ui_icons','ui_core','ui_feedback','ui_builder','ui_battle']
js = '\n'.join(open('src/%s.js' % f).read() for f in order) + '\nPF.App.boot();\n'
css = open('src/style.css').read() + '\n' + open('src/polish.css').read()
shell = open('src/shell.html').read()
js = js.replace('</script', '<\\/script')
page = shell.replace('/*CSS*/', css).replace('/*JS*/', js)
bundled_lib = '<script>' + open('vendor/three.min.js').read().replace('</script', '<\\/script') + '</script>'
# standalone page for GitHub Pages / direct hosting (the artifact viewer supplies its own skeleton)
HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<meta name="theme-color" content="#071015"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
        '<meta name="description" content="XCOM-style 3D tactics sandbox for the Pathfinder 2e rules.">'
        '')
# Keep metadata in the head in every standalone build. The local variant uses
# the same checked-in library without embedding another copy during development.
def document(library):
    body = page.replace('<!--LIBS-->', library).replace('</style>', '</style></head><body>', 1)
    return HEAD + body + '</body></html>'

os.makedirs('dist', exist_ok=True)
standalone = document(bundled_lib)
for path in ['index.html', 'dist/index.html', 'dist/three-action-tactics.html']:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(standalone)
with open('dist/local.html', 'w', encoding='utf-8') as f:
    f.write(document('<script src="../vendor/three.min.js"></script>'))
print('built', len(standalone.encode('utf-8')) // 1024, 'KB (self-contained engine)')
