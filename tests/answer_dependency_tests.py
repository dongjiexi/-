"""Independent symbolic checks of construction identities, not exam questions."""
import unittest
import sympy as s


class AnswerDependencyIdentities(unittest.TestCase):
    def test_translated_center_reflection(self):
        x, y, h, k = s.symbols('x y h k', real=True)
        reflected = s.Matrix([2*h-x, 2*k-y])
        self.assertEqual(s.simplify((s.Matrix([x, y])+reflected)/2), s.Matrix([h, k]))

    def test_global_axis_is_not_translated_center_axis(self):
        point = s.Matrix([8, 6])
        self.assertEqual(s.Matrix([point[0], -point[1]]), s.Matrix([8, -6]))
        self.assertNotEqual(-point[1], 2*s.Integer(1)-point[1])

    def test_specified_tangent_pair(self):
        x, y = s.symbols('x y', real=True)
        f = (x-2)**2+(y-1)**2-9
        def tangent(a, b):
            return s.diff(f, x).subs({x:a, y:b})*(x-a)+s.diff(f, y).subs({x:a, y:b})*(y-b)
        solution = s.solve([tangent(5, 1), tangent(2, 4)], [x, y])
        self.assertEqual(solution, {x:5, y:4})
        self.assertEqual(s.solve([tangent(5, 1), tangent(-1, 1)], [x, y]), [])

    def test_midpoint_inverse_equivalence(self):
        x, y = s.symbols('x y', real=True)
        original = (2*x-1)**2/s.Integer(9)+(2*y)**2/s.Integer(4)-1
        locus = (x-s.Rational(1,2))**2/s.Rational(9,4)+y**2-1
        self.assertEqual(s.expand(original-locus), 0)

    def test_midpoint_domain_is_not_whole_ellipse(self):
        # Original x>0 implies midpoint x>1/2; algebra equation alone includes
        # inadmissible x=-1, y=0, so reverse sufficiency needs the domain.
        x, y = s.Integer(-1), s.Integer(0)
        self.assertEqual((x-s.Rational(1,2))**2/s.Rational(9,4)+y*y, 1)
        self.assertFalse(2*x-1 > 0)


if __name__ == '__main__':
    unittest.main()
