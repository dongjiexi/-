"""Independent exact derivation; no browser formula or question-bank answer imports."""
import unittest
import sympy as s


class VertexSecantExactTests(unittest.TestCase):
    def test_general_elimination(self):
        a, b, u, m, delta = s.symbols('a b u m delta', nonzero=True)
        D = b**2*m**2-a**2
        total, product = -2*b**2*m*u/D, b**2*(u**2-a**2)/D
        self.assertEqual(s.factor((u**2-a**2)*total+2*u*m*product), 0)
        equation = (a**2/u)*(u*delta-a*total)+a*(2*m*product+u*total-a*delta)
        self.assertEqual(s.factor(equation), 0)

    def test_original_vertical_and_nonvertical_chords(self):
        for m in (s.Rational(-1, 3), s.Integer(0), s.Rational(1, 4)):
            y = s.Symbol('y', real=True)
            roots = s.solve((m*y-4)**2/4-y**2/16-1, y)
            roots.sort(key=lambda value: float(value), reverse=True)
            M, N = [s.Point(m*r-4, r) for r in roots]
            self.assertTrue(M.x < 0 and N.x < 0 and M.y > 0 and N.y < 0)
            P = s.Line(M, s.Point(-2, 0)).intersection(s.Line(N, s.Point(2, 0)))[0]
            self.assertEqual(s.simplify(P.x), -1)
            if m == 0:
                self.assertEqual(P.y, -2*s.sqrt(3))
