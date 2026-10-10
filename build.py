import sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
order = ['core','data_rules','data_classes','data_spells','data_spells_auto','data_bestiary','data_mc','data_maps','builder','engine','actions','ai','models','gfx','render3d','ui_icons','ui_core','ui_builder','ui_battle']
js = '\n'.join(open('src/%s.js' % f).read() for f in order) + '\nPF.App.boot();\n'
css = open('src/style.css').read()
shell = open('src/shell.html').read()
js = js.replace('</script', '<\\/script')
page = shell.replace('/*CSS*/', css).replace('/*JS*/', js)
cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
os.makedirs('dist', exist_ok=True)
open('dist/three-action-tactics.html','w').write(page.replace('<!--LIBS-->', cdn))
open('dist/local.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + page.replace('<!--LIBS-->', '<script src="../vendor/three.min.js"></script>') + '</body></html>')
print('built', len(page)//1024, 'KB')

# standalone page for GitHub Pages / direct hosting (the artifact viewer supplies its own skeleton)
HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<meta name="theme-color" content="#071015"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
        '<meta name="description" content="XCOM-style 3D tactics sandbox for the Pathfinder 2e rules.">'
        '</head><body>')
open('dist/index.html','w').write(HEAD + page.replace('<!--LIBS-->', cdn) + '</body></html>')
open('index.html','w').write(HEAD + page.replace('<!--LIBS-->', cdn) + '</body></html>')
