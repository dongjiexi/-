"""Independent exact algebra, not browser code or the bank's reference answers."""
import unittest
import sympy as s


class InverseLocusExactTests(unittest.TestCase):
    def test_general_locus_equivalence(self):
        m, n, d, power, factor = s.symbols('m n d power factor', nonzero=True)
        D = m*m+(n-d)**2
        rx, ry = power*m/D, d+power*(n-d)/D
        center = d+(factor-1)*power/(2*d)
        radius2 = center**2-d*d+power
        residual = m*m+(n-center)**2-radius2
        self.assertEqual(s.factor((ry/rx-factor*n/m)*power*m-d*residual), 0)

    def test_positive_inverse_coefficient(self):
        m, n, d = s.symbols('m n d', real=True)
        power = s.symbols('power', positive=True)
        D = m*m+(n-d)**2
        t = power/D
        self.assertEqual(s.factor(t*D-power), 0)
        self.assertEqual(s.factor((t*m)**2+(t*(n-d))**2-power**2/D), 0)

    def test_original_ellipse_and_locus(self):
        a2, b2 = s.symbols('a2 b2')
        solution = s.solve([b2-(1-s.Rational(8, 9))*a2, a2+b2-10], [a2, b2])
        self.assertEqual(solution, {a2: 9, b2: 1})
        m, n = s.symbols('m n')
        D = m*m+(n+1)**2
        self.assertEqual(s.simplify((-D+3*(n+1)-9*n)+(m*m+(n+4)**2-18)), 0)

    def test_closed_interval_distance_bound(self):
        y = s.symbols('y', real=True)
        squared_distance = 9*(1-y*y)+(y+4)**2
        self.assertEqual(s.factor(27-squared_distance-8*(y-s.Rational(1, 2))**2), 0)
        self.assertEqual(s.sqrt(18)+s.sqrt(27), 3*s.sqrt(2)+3*s.sqrt(3))

    def test_both_attained_equalities(self):
        for sign in (1, -1):
            mx, my = sign*3*s.sqrt(3)/2, s.Rational(1, 2)
            px, py = -sign*3*s.sqrt(2)/2, -4-3*s.sqrt(6)/2
            self.assertEqual(s.simplify(mx*mx/9+my*my), 1)
            self.assertEqual(s.simplify(px*px+(py+4)**2), 18)
            self.assertNotEqual(px, 0)
            self.assertEqual(s.simplify((px-mx)**2+(py-my)**2-(3*s.sqrt(2)+3*s.sqrt(3))**2), 0)
            D = px*px+(py+1)**2
            rx, ry = 3*px/D, -1+3*(py+1)/D
            self.assertEqual(s.simplify(ry/rx-3*py/px), 0)


if __name__ == '__main__':
    unittest.main()
