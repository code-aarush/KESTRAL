#!/usr/bin/env python3
"""
Unit tests for KESTREL Mission Control Viewport and Coordinate Transformations.
Validates the mathematical invariants of worldToScreen, screenToWorld,
cursor-centered zooming, Fit All calculations, and degenerate handling.
"""

import math
import unittest


class Viewport:
    def __init__(self, scale=1.0, tx=0.0, ty=0.0, min_scale=0.01, max_scale=100.0):
        self.scale = scale
        self.tx = tx
        self.ty = ty
        self.min_scale = min_scale
        self.max_scale = max_scale


def world_to_screen(vp: Viewport, wx: float, wy: float) -> tuple[float, float]:
    if not (math.isfinite(wx) and math.isfinite(wy) and math.isfinite(vp.scale) and math.isfinite(vp.tx) and math.isfinite(vp.ty)):
        return (math.nan, math.nan)
    return (wx * vp.scale + vp.tx, wy * vp.scale + vp.ty)


def screen_to_world(vp: Viewport, sx: float, sy: float) -> tuple[float, float]:
    if not (math.isfinite(sx) and math.isfinite(sy) and math.isfinite(vp.scale) and vp.scale != 0.0 and math.isfinite(vp.tx) and math.isfinite(vp.ty)):
        return (math.nan, math.nan)
    return ((sx - vp.tx) / vp.scale, (sy - vp.ty) / vp.scale)


def zoom_at(vp: Viewport, sx: float, sy: float, factor: float) -> None:
    if not (math.isfinite(sx) and math.isfinite(sy) and math.isfinite(factor) and factor > 0):
        return
    wx, wy = screen_to_world(vp, sx, sy)
    if not (math.isfinite(wx) and math.isfinite(wy)):
        return

    new_scale = max(vp.min_scale, min(vp.max_scale, vp.scale * factor))
    if abs(new_scale - vp.scale) < 1e-9:
        return

    vp.tx = sx - wx * new_scale
    vp.ty = sy - wy * new_scale
    vp.scale = new_scale


def compute_fit_transform(boxes, target_w=800.0, target_h=600.0, pad=40.0) -> dict:
    min_x, min_y, max_x, max_y = math.inf, math.inf, -math.inf, -math.inf

    for b in boxes:
        if not (isinstance(b, (list, tuple)) and len(b) >= 4):
            continue
        x1, x2 = min(b[0], b[2]), max(b[0], b[2])
        y1, y2 = min(b[1], b[3]), max(b[1], b[3])
        if all(math.isfinite(v) for v in (x1, x2, y1, y2)):
            min_x = min(min_x, x1)
            max_x = max(max_x, x2)
            min_y = min(min_y, y1)
            maxY = max(max_y, y2)
            max_y = maxY

    if not all(math.isfinite(v) for v in (min_x, min_y, max_x, max_y)):
        return {"scale": 1.0, "tx": target_w / 2.0, "ty": target_h / 2.0}

    span_x = max_x - min_x
    span_y = max_y - min_y
    avail_w = max(target_w - 2.0 * pad, 10.0)
    avail_h = max(target_h - 2.0 * pad, 10.0)

    if span_x > 0 and span_y > 0:
        scale = min(avail_w / span_x, avail_h / span_y)
    elif span_x > 0:
        scale = avail_w / span_x
    elif span_y > 0:
        scale = avail_h / span_y
    else:
        scale = 1.0

    scale = max(0.0001, min(10000.0, scale))
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    tx = target_w / 2.0 - center_x * scale
    ty = target_h / 2.0 - center_y * scale

    return {"scale": scale, "tx": tx, "ty": ty, "min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y}


def calc_overlap_area(a: dict, b: dict) -> float:
    x_overlap = max(0.0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
    y_overlap = max(0.0, min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]))
    return x_overlap * y_overlap


class TestViewportTransform(unittest.TestCase):
    def test_overlap_area_calculation(self):
        # Disjoint boxes
        box1 = {"x": 0.0, "y": 0.0, "w": 10.0, "h": 10.0}
        box2 = {"x": 20.0, "y": 20.0, "w": 10.0, "h": 10.0}
        self.assertEqual(calc_overlap_area(box1, box2), 0.0)

        # Touching edges (non-overlapping)
        box3 = {"x": 10.0, "y": 0.0, "w": 10.0, "h": 10.0}
        self.assertEqual(calc_overlap_area(box1, box3), 0.0)

        # Partial overlap (5x5 overlap)
        box4 = {"x": 5.0, "y": 5.0, "w": 10.0, "h": 10.0}
        self.assertEqual(calc_overlap_area(box1, box4), 25.0)

        # Fully contained box (inside 10x10)
        box5 = {"x": 2.0, "y": 2.0, "w": 4.0, "h": 4.0}
        self.assertEqual(calc_overlap_area(box1, box5), 16.0)

    def test_round_trip(self):
        vp = Viewport(scale=2.35, tx=120.5, ty=-45.2)
        test_points = [
            (0.0, 0.0),
            (100.0, 200.0),
            (-170.409, 55.804),
            (822.895, -647.174),
            (0.0001, -0.0005),
        ]
        for wx, wy in test_points:
            sx, sy = world_to_screen(vp, wx, wy)
            r_wx, r_wy = screen_to_world(vp, sx, sy)
            self.assertAlmostEqual(wx, r_wx, places=9)
            self.assertAlmostEqual(wy, r_wy, places=9)

    def test_cursor_centered_zoom_pinning(self):
        vp = Viewport(scale=1.5, tx=80.0, ty=110.0)
        cursor_x, cursor_y = 350.0, 280.0

        # World point under cursor before zoom
        w_before_x, w_before_y = screen_to_world(vp, cursor_x, cursor_y)

        # Zoom in
        zoom_at(vp, cursor_x, cursor_y, 1.25)
        w_after_zoom_in_x, w_after_zoom_in_y = screen_to_world(vp, cursor_x, cursor_y)
        self.assertAlmostEqual(w_before_x, w_after_zoom_in_x, places=9)
        self.assertAlmostEqual(w_before_y, w_after_zoom_in_y, places=9)

        # Zoom out
        zoom_at(vp, cursor_x, cursor_y, 1.0 / 1.5)
        w_after_zoom_out_x, w_after_zoom_out_y = screen_to_world(vp, cursor_x, cursor_y)
        self.assertAlmostEqual(w_before_x, w_after_zoom_out_x, places=9)
        self.assertAlmostEqual(w_before_y, w_after_zoom_out_y, places=9)

    def test_pan_consistency(self):
        vp = Viewport(scale=2.0, tx=50.0, ty=50.0)
        p1_w = (10.0, 20.0)
        p2_w = (40.0, 60.0)

        s1_before = world_to_screen(vp, *p1_w)
        s2_before = world_to_screen(vp, *p2_w)

        # Pan by dx=30, dy=-15
        dx, dy = 30.0, -15.0
        vp.tx += dx
        vp.ty += dy

        s1_after = world_to_screen(vp, *p1_w)
        s2_after = world_to_screen(vp, *p2_w)

        self.assertAlmostEqual(s1_after[0] - s1_before[0], dx)
        self.assertAlmostEqual(s1_after[1] - s1_before[1], dy)
        self.assertAlmostEqual(s2_after[0] - s2_before[0], dx)
        self.assertAlmostEqual(s2_after[1] - s2_before[1], dy)

    def test_invalid_and_non_finite_inputs(self):
        vp = Viewport(scale=1.0, tx=0.0, ty=0.0)

        # NaN input
        sx, sy = world_to_screen(vp, float("nan"), 10.0)
        self.assertTrue(math.isnan(sx) and math.isnan(sy))

        # Inf input
        sx, sy = world_to_screen(vp, float("inf"), 10.0)
        self.assertTrue(math.isnan(sx) and math.isnan(sy))

        # Zero scale inverse
        vp_zero = Viewport(scale=0.0, tx=10.0, ty=10.0)
        wx, wy = screen_to_world(vp_zero, 100.0, 100.0)
        self.assertTrue(math.isnan(wx) and math.isnan(wy))

    def test_fit_all_standard_dataset(self):
        # Sample boxes matching state.json extents: [55.8042, -170.409, 822.895, 647.174]
        boxes = [
            [55.8042, -170.409, 822.895, 647.174],
            [200.0, 200.0, 600.0, 400.0],
            [295.344, 288.242, 304.001, 290.033],
        ]
        fit = compute_fit_transform(boxes, target_w=800, target_h=600, pad=40)
        self.assertGreater(fit["scale"], 0.0)
        self.assertTrue(math.isfinite(fit["tx"]))
        self.assertTrue(math.isfinite(fit["ty"]))

        # Verify all four corners of the union box map inside the canvas bounds
        vp = Viewport(scale=fit["scale"], tx=fit["tx"], ty=fit["ty"])
        s_min = world_to_screen(vp, fit["min_x"], fit["min_y"])
        s_max = world_to_screen(vp, fit["max_x"], fit["max_y"])

        self.assertGreaterEqual(s_min[0], 39.9)
        self.assertLessEqual(s_max[0], 760.1)
        self.assertGreaterEqual(s_min[1], 39.9)
        self.assertLessEqual(s_max[1], 560.1)

    def test_fit_all_degenerate_and_empty(self):
        # Empty dataset
        empty_fit = compute_fit_transform([], target_w=800, target_h=600)
        self.assertEqual(empty_fit["scale"], 1.0)
        self.assertEqual(empty_fit["tx"], 400.0)
        self.assertEqual(empty_fit["ty"], 300.0)

        # Single degenerate point box
        point_box = [[100.0, 200.0, 100.0, 200.0]]
        point_fit = compute_fit_transform(point_box, target_w=800, target_h=600)
        self.assertGreater(point_fit["scale"], 0.0)
        self.assertTrue(math.isfinite(point_fit["tx"]))
        self.assertTrue(math.isfinite(point_fit["ty"]))

        # Invalid boxes
        invalid_boxes = [[math.nan, 0, 1, 1], ["invalid", "bad"], [1, 2]]
        inv_fit = compute_fit_transform(invalid_boxes, target_w=800, target_h=600)
        self.assertEqual(inv_fit["scale"], 1.0)
        self.assertEqual(inv_fit["tx"], 400.0)

    def test_fit_all_large_coordinates(self):
        # Spanning 0 to 5,000,000 in X and 0 to 3,000,000 in Y
        boxes = [[0.0, 0.0, 5_000_000.0, 3_000_000.0]]
        fit = compute_fit_transform(boxes, target_w=800, target_h=600, pad=40)
        self.assertGreater(fit["scale"], 0.0)
        self.assertTrue(math.isfinite(fit["tx"]))
        self.assertTrue(math.isfinite(fit["ty"]))

        vp = Viewport(scale=fit["scale"], tx=fit["tx"], ty=fit["ty"])
        s_min = world_to_screen(vp, 0.0, 0.0)
        s_max = world_to_screen(vp, 5_000_000.0, 3_000_000.0)
        self.assertGreaterEqual(s_min[0], 39.9)
        self.assertLessEqual(s_max[0], 760.1)
        self.assertGreaterEqual(s_min[1], 39.9)
        self.assertLessEqual(s_max[1], 560.1)

    def test_fit_all_small_coordinates(self):
        # Spanning 0 to 0.005 in X and 0 to 0.002 in Y
        boxes = [[0.0, 0.0, 0.005, 0.002]]
        fit = compute_fit_transform(boxes, target_w=800, target_h=600, pad=40)
        self.assertGreater(fit["scale"], 0.0)
        self.assertTrue(math.isfinite(fit["tx"]))
        self.assertTrue(math.isfinite(fit["ty"]))

        vp = Viewport(scale=fit["scale"], tx=fit["tx"], ty=fit["ty"])
        s_min = world_to_screen(vp, 0.0, 0.0)
        s_max = world_to_screen(vp, 0.005, 0.002)
        self.assertGreaterEqual(s_min[0], 39.9)
        self.assertLessEqual(s_max[0], 760.1)
        self.assertGreaterEqual(s_min[1], 39.9)
        self.assertLessEqual(s_max[1], 560.1)

    def test_fit_all_non_square(self):
        # Very wide aspect ratio: 2000 x 50
        boxes = [[0.0, 0.0, 2000.0, 50.0]]
        fit = compute_fit_transform(boxes, target_w=800, target_h=600, pad=40)
        self.assertGreater(fit["scale"], 0.0)
        vp = Viewport(scale=fit["scale"], tx=fit["tx"], ty=fit["ty"])
        s_min = world_to_screen(vp, 0.0, 0.0)
        s_max = world_to_screen(vp, 2000.0, 50.0)
        self.assertGreaterEqual(s_min[0], 39.9)
        self.assertLessEqual(s_max[0], 760.1)
        # Should be centered vertically
        center_y = (s_min[1] + s_max[1]) / 2.0
        self.assertAlmostEqual(center_y, 300.0, places=1)

    def test_fit_all_negative_coordinates(self):
        # Negative coordinate quadrant: [-800, -600, -200, -100]
        boxes = [[-800.0, -600.0, -200.0, -100.0]]
        fit = compute_fit_transform(boxes, target_w=800, target_h=600, pad=40)
        self.assertGreater(fit["scale"], 0.0)
        vp = Viewport(scale=fit["scale"], tx=fit["tx"], ty=fit["ty"])
        s_min = world_to_screen(vp, -800.0, -600.0)
        s_max = world_to_screen(vp, -200.0, -100.0)
        self.assertGreaterEqual(s_min[0], 39.9)
        self.assertLessEqual(s_max[0], 760.1)
        self.assertGreaterEqual(s_min[1], 39.9)
        self.assertLessEqual(s_max[1], 560.1)


if __name__ == "__main__":
    unittest.main()
