#!/usr/bin/env python3
"""splice.py MARKER PARTFILE — replace /*__MARKER__*/ in src/models.js with the contents of PARTFILE (dev helper)."""
import sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(root, 'src', 'models.js')
s = open(p).read()
marker = '/*__' + sys.argv[1] + '__*/'
if marker not in s:
    sys.exit('marker not found: ' + marker)
s = s.replace(marker, open(sys.argv[2]).read())
open(p, 'w').write(s)
print('spliced', sys.argv[1], len(s), 'chars')
