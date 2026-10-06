"""Exact independent calculations, not browser numeric sampling proofs."""
import unittest
import sympy as s


class ConditionModelsExactTests(unittest.TestCase):
    def test_general_area_polynomial(self):
        a2, b2, d, k, w, area = s.symbols('a2 b2 d k w area', nonzero=True)
        A, B, C = b2+a2*k*k, 2*a2*d*k, a2*(d*d-b2)
        delta = s.factor(B*B-4*A*C)
        self.assertEqual(s.factor(delta-4*a2*b2*(a2*k*k+b2-d*d)), 0)
        area2 = s.factor(d*d*delta/(4*A*A))
        self.assertEqual(s.factor(area2.subs(k*k, (w-b2)/a2)-a2*b2*d*d*(w-d*d)/w**2), 0)

    def test_source_answer_and_finite_endpoints(self):
        k2 = s.symbols('k2', nonnegative=True)
        self.assertEqual(s.solve(2*(2+4*k2)**2-32*(4*k2-2), k2), [s.Rational(3, 2)])
        x = s.symbols('x')
        k = s.sqrt(s.Rational(3, 2))
        xs = s.solve(s.Eq(x*x/4+(k*x-2)**2/2, 1), x)
        self.assertEqual(s.simplify((xs[1]-xs[0])**2), 2)
        self.assertEqual(s.simplify((1+k*k)*(xs[1]-xs[0])**2), 5)
        self.assertGreater(4*4*2*(4*k*k+2-4), 0)

    def test_closed_nested_radical_length(self):
        a2, b2, d, S, sign = s.symbols('a2 b2 d S sign', nonzero=True)
        D = s.sqrt(1-4*S*S/(a2*b2))
        w = a2*b2*d*d*(1+sign*D)/(2*S*S)
        length2 = 4*S*S/(d*d)*(1+(w-b2)/a2)
        self.assertEqual(s.factor(length2-(2*b2+4*S*S/(d*d)*(1-b2/a2)+sign*2*b2*D)), 0)

    def test_basic_definitions(self):
        self.assertEqual(s.solve(s.Eq(2*s.Symbol('a')-1, 0), s.Symbol('a')), [s.Rational(1, 2)])
        self.assertEqual(4*s.Integer(3)/2, 6)
        self.assertEqual(s.Integer(2)**2*(1-(s.sqrt(2)/2)**2), 2)

    def test_named_quadrant_requires_endpoint_reassignment(self):
        x = s.symbols('x', real=True)
        k = s.sqrt(6)/2
        xs = s.solve(s.Eq(x*x/4+(k*x-2)**2/2, 1), x)
        points = [(v, s.simplify(k*v-2)) for v in xs]
        self.assertTrue(all(px > 0 for px, _ in points))
        self.assertLess(points[0][1], 0)
        self.assertGreater(points[1][1], 0)
        ax, ay = points[1]  # A in quadrant I, not the default left endpoint.
        bx, by = points[0]
        self.assertEqual(s.simplify((ax-bx)**2+(ay-by)**2), 5)
        self.assertEqual(s.simplify(abs(ax*by-ay*bx)/2), s.sqrt(2))

    def test_swapped_axis_uses_reciprocal_physical_slope(self):
        y = s.symbols('y', real=True)
        k = s.sqrt(2)  # Internal x=k*y-2, NOT the slope in xOy.
        ys = s.solve(s.Eq((k*y-2)**2/4+y*y/2, 1), y)
        points = [(s.simplify(k*v-2), v) for v in ys]
        ax, ay = points[0]
        bx, by = points[1]
        self.assertEqual(s.simplify((by-ay)/(bx-ax)), s.sqrt(2)/2)
        self.assertEqual(s.simplify(abs(ax*by-ay*bx)/2), s.sqrt(2))


if __name__ == '__main__':
    unittest.main()
