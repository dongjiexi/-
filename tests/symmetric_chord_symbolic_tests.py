"""Independent exact family elimination, secants, ray angles and area."""
import unittest
import sympy as s


class SymmetricChordExactTests(unittest.TestCase):
    def test_family_elimination(self):
        z, u, v, delta = s.symbols('z u v delta', nonzero=True)
        expression = u*u/z-v*v/(z-delta)-1
        polynomial = z*z-(delta+u*u-v*v)*z+delta*u*u
        self.assertEqual(s.factor(expression*z*(z-delta)+polynomial), 0)
        self.assertEqual(s.solve(polynomial.subs({u: 2, v: 1, delta: 1}), z), [2])

    def test_general_slope_identity(self):
        alpha, beta, u, v, t = s.symbols('alpha beta u v t', nonzero=True)
        D = alpha+beta*t*t
        rp, rq = -2*(alpha*u+beta*v*t)/D, -2*(alpha*u-beta*v*t)/D
        self.assertEqual(s.factor(t*(rp+rq)/(rp-rq)-alpha*u/(beta*v)), 0)
        self.assertEqual(s.factor(rp*rq-4*(alpha*alpha*u*u-beta*beta*v*v*t*t)/D**2), 0)

    def test_original_roots_and_actual_ray_angle(self):
        t = s.symbols('t', positive=True)
        roots = s.solve(4*t*t-8*(1-t*t)**2, t)
        self.assertEqual(set(roots), {s.sqrt(2)/2, s.sqrt(2)})
        self.assertEqual(s.Rational(1, 2)-(s.sqrt(2)/2)**2, 0)
        rp = -2*(1-s.sqrt(2))/(s.Rational(1, 2)-2)
        rq = -2*(1+s.sqrt(2))/(s.Rational(1, 2)-2)
        dot, cross = rp*rq*(1-2), -2*s.sqrt(2)*rp*rq
        self.assertGreater(dot, 0)
        self.assertEqual(s.simplify(s.Abs(cross)/dot), 2*s.sqrt(2))
        self.assertEqual(s.simplify(s.Abs(cross)/2), 16*s.sqrt(2)/9)

    def test_original_endpoints(self):
        t = s.sqrt(2)
        rp, rq = -2*(1-t)/(s.Rational(1, 2)-t*t), -2*(1+t)/(s.Rational(1, 2)-t*t)
        P, Q = s.Point(2+rp, 1+t*rp), s.Point(2+rq, 1-t*rq)
        for p in (P, Q):
            self.assertEqual(s.simplify(p.x*p.x/2-p.y*p.y), 1)
        self.assertEqual(s.simplify((Q.y-P.y)/(Q.x-P.x)), -1)
        self.assertNotEqual(P, s.Point(2, 1))
        self.assertNotEqual(P, Q)

    def test_reflected_tangent_exclusion(self):
        u, v, a2, b2 = s.symbols('u v a2 b2', nonzero=True)
        x, y = u*(1+4*v*v/b2), v*(1-4*u*u/a2)
        self.assertEqual(s.factor((y-v)/(x-u)+u*b2/(v*a2)), 0)
        self.assertEqual(s.factor((x*x/a2-y*y/b2-1).subs(u*u, a2*(1+v*v/b2))), 0)


if __name__ == '__main__':
    unittest.main()
