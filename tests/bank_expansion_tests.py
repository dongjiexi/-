import json
import math
import unittest
from pathlib import Path

ITEMS = {q['id']: q for q in json.loads((Path(__file__).resolve().parents[1] / 'dist/question-bank.json').read_text(encoding='utf-8'))['items']}

class BankExpansionTests(unittest.TestCase):
    def test_ellipse_area_ratio_and_secant(self):
        s = ITEMS['2023-ii-5']['scene']
        m = s['lines'][0]['c']
        self.assertGreater(48-12*m*m, 0)
        self.assertAlmostEqual(abs(m-math.sqrt(2))/abs(m+math.sqrt(2)), 2)
        for name in ['A', 'B']:
            x, y = s['points'][name]
            self.assertAlmostEqual(x*x/3+y*y, 1)
            self.assertAlmostEqual(y, x+m)
        self.assertLess(48-12*(-3*math.sqrt(2))**2, 0)

    def test_parabola_chord_circle_and_choices(self):
        s = ITEMS['2023-ii-10']['scene']
        M, N = s['points']['M'], s['points']['N']
        for x, y in [M, N]:
            self.assertAlmostEqual(y*y, 4*x)
            self.assertAlmostEqual(y, -math.sqrt(3)*(x-1))
        self.assertAlmostEqual(math.dist(M, N), 16/3)
        circle = s['objects'][0]
        self.assertAlmostEqual(circle['h']+1, circle['r'])
        self.assertAlmostEqual(math.dist([circle['h'], circle['k']], M), circle['r'])
        self.assertAlmostEqual(sum(v*v for v in M), 21)
        self.assertAlmostEqual(sum(v*v for v in N), 13/9)

    def test_vector_representative(self):
        p = ITEMS['2024-ii-3']['scene']['points']
        self.assertAlmostEqual(math.hypot(*p['A']), 1)
        self.assertAlmostEqual(math.hypot(*p['T']), 2)
        self.assertAlmostEqual(sum(x*y for x,y in zip(p['D'],p['B'])), 0)
        self.assertAlmostEqual(math.hypot(*p['B']), math.sqrt(2)/2)
        self.assertAlmostEqual(p['T'][0], p['A'][0]+2*p['B'][0])

    def test_hyperbola_orientation(self):
        s=ITEMS['2022-beijing-12']['scene']
        self.assertEqual(s['orientation'], 'vertical')
        self.assertAlmostEqual(s['a']/s['b'], math.sqrt(3)/3)
