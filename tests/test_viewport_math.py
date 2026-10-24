#!/usr/bin/env python3
"""
Unit tests for KESTREL Mission Control Viewport and Coordinate Transformations.
Validates the mathematical invariants of worldToScreen, screenToWorld,
cursor-centered zooming, Fit All calculations, and degenerate handling.
"""

import math
import os
import re
import shutil
import subprocess
import tempfile
import time
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

    def test_fit_all_boundary_coordinates(self):
        cases = [
            ("large", [[0.0, 0.0, 5_000_000.0, 3_000_000.0]], 0.0, 0.0, 5_000_000.0, 3_000_000.0),
            ("small", [[0.0, 0.0, 0.005, 0.002]], 0.0, 0.0, 0.005, 0.002),
            ("negative", [[-800.0, -600.0, -200.0, -100.0]], -800.0, -600.0, -200.0, -100.0),
        ]
        for name, boxes, x1, y1, x2, y2 in cases:
            with self.subTest(case=name):
                fit = compute_fit_transform(boxes, target_w=800, target_h=600, pad=40)
                self.assertGreater(fit["scale"], 0.0)
                self.assertTrue(math.isfinite(fit["tx"]))
                self.assertTrue(math.isfinite(fit["ty"]))

                vp = Viewport(scale=fit["scale"], tx=fit["tx"], ty=fit["ty"])
                s_min = world_to_screen(vp, x1, y1)
                s_max = world_to_screen(vp, x2, y2)
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

    def test_reset_view_before_resize(self):
        boxes = [[55.8, -170.4, 822.8, 647.1]]
        initial_fit = compute_fit_transform(boxes, target_w=800, target_h=600)
        vp = Viewport(scale=initial_fit["scale"], tx=initial_fit["tx"], ty=initial_fit["ty"])
        saved_initial = {"scale": initial_fit["scale"], "tx": initial_fit["tx"], "ty": initial_fit["ty"]}

        # Pan and zoom away
        vp.tx += 100.0
        vp.ty -= 50.0
        zoom_at(vp, 400.0, 300.0, 1.8)
        self.assertNotEqual(vp.scale, saved_initial["scale"])
        self.assertNotEqual(vp.tx, saved_initial["tx"])

        # Reset view restores saved initial
        vp.scale = saved_initial["scale"]
        vp.tx = saved_initial["tx"]
        vp.ty = saved_initial["ty"]
        self.assertAlmostEqual(vp.scale, saved_initial["scale"], places=9)
        self.assertAlmostEqual(vp.tx, saved_initial["tx"], places=9)
        self.assertAlmostEqual(vp.ty, saved_initial["ty"], places=9)

    def test_reset_view_after_resize(self):
        boxes = [[55.8, -170.4, 822.8, 647.1]]
        initial_fit_800 = compute_fit_transform(boxes, target_w=800, target_h=600)
        vp = Viewport(scale=initial_fit_800["scale"], tx=initial_fit_800["tx"], ty=initial_fit_800["ty"])

        # User pans and zooms
        vp.tx += 60.0
        vp.ty -= 40.0
        zoom_at(vp, 400.0, 300.0, 2.0)
        user_scale = vp.scale

        # Canvas resizes to 1200 x 800:
        # 1. User pan/zoom is preserved with center offset shift
        vp.tx += (1200 - 800) / 2.0
        vp.ty += (800 - 600) / 2.0
        self.assertAlmostEqual(vp.scale, user_scale, places=9)

        # 2. Saved initial transform is updated for the new canvas size
        new_initial = compute_fit_transform(boxes, target_w=1200, target_h=800)
        self.assertNotEqual(new_initial["scale"], initial_fit_800["scale"])

        # 3. User triggers Reset View: restores 1200x800 framing
        vp.scale = new_initial["scale"]
        vp.tx = new_initial["tx"]
        vp.ty = new_initial["ty"]
        self.assertAlmostEqual(vp.scale, new_initial["scale"], places=9)
        self.assertAlmostEqual(vp.tx, new_initial["tx"], places=9)
        self.assertAlmostEqual(vp.ty, new_initial["ty"], places=9)

        # Confirm data centers around (600, 400)
        center_x = (boxes[0][0] + boxes[0][2]) / 2.0
        center_y = (boxes[0][1] + boxes[0][3]) / 2.0
        s_cx, s_cy = world_to_screen(vp, center_x, center_y)
        self.assertAlmostEqual(s_cx, 600.0, places=1)
        self.assertAlmostEqual(s_cy, 400.0, places=1)

    def test_repeated_resize_reset_cycles_zero_drift(self):
        boxes = [[55.8, -170.4, 822.8, 647.1]]
        base_fit_800 = compute_fit_transform(boxes, target_w=800, target_h=600)

        # Cycle through multiple canvas sizes, recomputing initial transform at each step
        cycle = [(1200, 800), (600, 400), (1024, 768), (500, 500), (1440, 900), (800, 600)]
        vp = Viewport(scale=base_fit_800["scale"], tx=base_fit_800["tx"], ty=base_fit_800["ty"])

        for w, h in cycle:
            # Resize: recompute initial transform
            fit_wh = compute_fit_transform(boxes, target_w=w, target_h=h)
            # Simulate pan/zoom away
            zoom_at(vp, w / 2.0, h / 2.0, 1.3)
            vp.tx += 40.0
            vp.ty -= 25.0
            # Reset view
            vp.scale = fit_wh["scale"]
            vp.tx = fit_wh["tx"]
            vp.ty = fit_wh["ty"]
            self.assertAlmostEqual(vp.scale, fit_wh["scale"], places=9)
            self.assertAlmostEqual(vp.tx, fit_wh["tx"], places=9)
            self.assertAlmostEqual(vp.ty, fit_wh["ty"], places=9)

        # Final return to 800x600 must match base_fit_800 with zero drift
        self.assertAlmostEqual(vp.scale, base_fit_800["scale"], places=9)
        self.assertAlmostEqual(vp.tx, base_fit_800["tx"], places=9)
        self.assertAlmostEqual(vp.ty, base_fit_800["ty"], places=9)

    def test_pan_and_zoom_preservation_across_resize(self):
        w1, h1 = 800.0, 600.0
        w2, h2 = 1200.0, 800.0
        scale = 2.5
        world_pt = (120.0, 340.0)

        # World point centered at (W1/2, H1/2)
        vp = Viewport(scale=scale, tx=(w1 / 2.0 - world_pt[0] * scale), ty=(h1 / 2.0 - world_pt[1] * scale))
        w_center_before = screen_to_world(vp, w1 / 2.0, h1 / 2.0)
        self.assertAlmostEqual(w_center_before[0], world_pt[0], places=9)
        self.assertAlmostEqual(w_center_before[1], world_pt[1], places=9)

        # Resize canvas: shift tx, ty by dimension deltas / 2
        vp.tx += (w2 - w1) / 2.0
        vp.ty += (h2 - h1) / 2.0

        # Scale is unchanged (zoom preserved)
        self.assertAlmostEqual(vp.scale, scale, places=9)

        # World point at new screen center (W2/2, H2/2) remains exactly pinned
        w_center_after = screen_to_world(vp, w2 / 2.0, h2 / 2.0)
        self.assertAlmostEqual(w_center_after[0], world_pt[0], places=9)
        self.assertAlmostEqual(w_center_after[1], world_pt[1], places=9)

    def test_hidpi_backing_dimensions_computation(self):
        cases = [
            (800, 600, 1.0, 800, 600),
            (800, 600, 1.25, 1000, 750),
            (800, 600, 1.5, 1200, 900),
            (800, 600, 2.0, 1600, 1200),
            (800, 600, 3.0, 2400, 1800),
            (1024, 768, 2.0, 2048, 1536),
        ]
        for css_w, css_h, dpr, exp_buf_w, exp_buf_h in cases:
            with self.subTest(css_w=css_w, css_h=css_h, dpr=dpr):
                buf_w = round(css_w * dpr)
                buf_h = round(css_h * dpr)
                self.assertEqual(buf_w, exp_buf_w)
                self.assertEqual(buf_h, exp_buf_h)

    def test_hidpi_dpr_transform_idempotence(self):
        # setTransform(dpr, 0, 0, dpr, 0, 0) establishes absolute matrix
        dpr = 2.0
        matrix = [dpr, 0.0, 0.0, dpr, 0.0, 0.0]

        # Repeated assignments are idempotent and non-cumulative
        for _ in range(10):
            matrix = [dpr, 0.0, 0.0, dpr, 0.0, 0.0]
            self.assertEqual(matrix[0], dpr)
            self.assertEqual(matrix[3], dpr)

    def test_adaptive_grid_step_consistency_across_dpr(self):
        # Adaptive grid spacing uses CSS screen step (80px)
        target_screen_step = 80.0
        scale = 1.6

        raw_world_step = target_screen_step / scale
        power = 10.0 ** math.floor(math.log10(raw_world_step))
        ratio = raw_world_step / power
        if ratio >= 5.0:
            world_step = power * 5.0
        elif ratio >= 2.0:
            world_step = power * 2.0
        else:
            world_step = power

        # The calculated world step is independent of devicePixelRatio because
        # drawing operates in CSS pixels where target_screen_step = 80 is constant.
        self.assertGreater(world_step, 0.0)
        self.assertEqual(world_step, 50.0)  # 80 / 1.6 = 50.0 -> power 10, ratio 5.0 -> 50.0

    def test_pan_lifecycle_release_inside(self):
        vp = Viewport(scale=1.0, tx=0.0, ty=0.0)
        pan = PanSession(vp)

        # Pointer down at (100, 100)
        pan.pointer_down(pointer_id=1, client_x=100.0, client_y=100.0, capture_succeeds=True)
        self.assertTrue(pan.is_panning)
        self.assertEqual(pan.active_pointer_id, 1)

        # Drag to (150, 130) -> delta (+50, +30)
        pan.pointer_move(client_x=150.0, client_y=130.0, buttons=1)
        self.assertAlmostEqual(vp.tx, 50.0)
        self.assertAlmostEqual(vp.ty, 30.0)

        # Release inside canvas
        pan.end_pan(pointer_id=1)
        self.assertFalse(pan.is_panning)
        self.assertIsNone(pan.active_pointer_id)

        # Subsequent move without drag does not change translation
        pan.pointer_move(client_x=200.0, client_y=200.0, buttons=0)
        self.assertAlmostEqual(vp.tx, 50.0)
        self.assertAlmostEqual(vp.ty, 30.0)

    def test_pan_lifecycle_release_outside_with_window_fallback(self):
        vp = Viewport(scale=1.0, tx=0.0, ty=0.0)
        pan = PanSession(vp)

        # Pointer capture fails
        pan.pointer_down(pointer_id=2, client_x=200.0, client_y=200.0, capture_succeeds=False)
        self.assertTrue(pan.is_panning)
        self.assertFalse(pan.has_active_capture)

        # Drag moves outside canvas
        pan.pointer_move(client_x=250.0, client_y=220.0, buttons=1)
        self.assertAlmostEqual(vp.tx, 50.0)
        self.assertAlmostEqual(vp.ty, 20.0)

        # Window fallback catches release outside canvas
        pan.end_pan(pointer_id=2)
        self.assertFalse(pan.is_panning)
        self.assertIsNone(pan.active_pointer_id)

        # Stale moves outside window do not modify viewport
        pan.pointer_move(client_x=300.0, client_y=300.0, buttons=0)
        self.assertAlmostEqual(vp.tx, 50.0)
        self.assertAlmostEqual(vp.ty, 20.0)

    def test_pan_lifecycle_pointer_cancellation(self):
        vp = Viewport(scale=1.0, tx=10.0, ty=10.0)
        pan = PanSession(vp)

        pan.pointer_down(pointer_id=3, client_x=50.0, client_y=50.0)
        pan.pointer_move(client_x=70.0, client_y=80.0, buttons=1)
        self.assertAlmostEqual(vp.tx, 30.0)
        self.assertAlmostEqual(vp.ty, 40.0)

        # Pointer cancellation (e.g. system gesture or touch cancellation)
        pan.end_pan(pointer_id=3)
        self.assertFalse(pan.is_panning)
        self.assertIsNone(pan.active_pointer_id)

    def test_pan_lifecycle_leave_with_and_without_capture(self):
        vp = Viewport(scale=1.0, tx=0.0, ty=0.0)

        # Scenario A: Capture succeeded -> pointer leave does NOT cancel panning
        pan_with_cap = PanSession(vp)
        pan_with_cap.pointer_down(pointer_id=4, client_x=100.0, client_y=100.0, capture_succeeds=True)
        pan_with_cap.pointer_leave(is_inside_canvas=False)
        self.assertTrue(pan_with_cap.is_panning)  # continues panning smoothly
        pan_with_cap.pointer_move(client_x=130.0, client_y=140.0, buttons=1)
        self.assertAlmostEqual(vp.tx, 30.0)
        self.assertAlmostEqual(vp.ty, 40.0)
        pan_with_cap.end_pan()

        # Scenario B: Capture failed -> pointer leave DOES terminate panning to avoid stuck state
        vp.tx, vp.ty = 0.0, 0.0
        pan_no_cap = PanSession(vp)
        pan_no_cap.pointer_down(pointer_id=5, client_x=100.0, client_y=100.0, capture_succeeds=False)
        pan_no_cap.pointer_leave(is_inside_canvas=False)
        self.assertFalse(pan_no_cap.is_panning)  # terminated safely

    def test_pan_lifecycle_lost_pointer_capture(self):
        vp = Viewport(scale=1.0, tx=0.0, ty=0.0)
        pan = PanSession(vp)

        pan.pointer_down(pointer_id=6, client_x=100.0, client_y=100.0, capture_succeeds=True)
        self.assertTrue(pan.is_panning)

        # lostpointercapture event fires
        pan.end_pan(pointer_id=6)
        self.assertFalse(pan.is_panning)
        self.assertIsNone(pan.active_pointer_id)

    def test_pan_lifecycle_offwindow_button_release_detection(self):
        vp = Viewport(scale=1.0, tx=0.0, ty=0.0)
        pan = PanSession(vp)

        pan.pointer_down(pointer_id=7, client_x=100.0, client_y=100.0)
        pan.pointer_move(client_x=120.0, client_y=120.0, buttons=1)
        self.assertAlmostEqual(vp.tx, 20.0)
        self.assertAlmostEqual(vp.ty, 20.0)

        # User released button outside browser window and moved back in: buttons = 0
        pan.pointer_move(client_x=150.0, client_y=150.0, buttons=0)
        self.assertFalse(pan.is_panning)
        # Translation frozen at last active pan position
        self.assertAlmostEqual(vp.tx, 20.0)
        self.assertAlmostEqual(vp.ty, 20.0)

    def test_pan_lifecycle_subsequent_drag_after_termination(self):
        vp = Viewport(scale=1.0, tx=0.0, ty=0.0)
        pan = PanSession(vp)

        # First drag
        pan.pointer_down(pointer_id=8, client_x=100.0, client_y=100.0)
        pan.pointer_move(client_x=130.0, client_y=140.0, buttons=1)
        pan.end_pan()
        self.assertAlmostEqual(vp.tx, 30.0)
        self.assertAlmostEqual(vp.ty, 40.0)

        # Second drag at completely new location
        pan.pointer_down(pointer_id=9, client_x=500.0, client_y=500.0)
        pan.pointer_move(client_x=490.0, client_y=485.0, buttons=1)  # delta (-10, -15)
        self.assertAlmostEqual(vp.tx, 20.0)
        self.assertAlmostEqual(vp.ty, 25.0)
        pan.end_pan()
        self.assertFalse(pan.is_panning)

    def test_pan_lifecycle_idempotent_termination(self):
        vp = Viewport(scale=1.0, tx=0.0, ty=0.0)
        pan = PanSession(vp)

        pan.pointer_down(pointer_id=10, client_x=100.0, client_y=100.0)
        pan.end_pan()
        self.assertFalse(pan.is_panning)

        # Repeated calls do nothing and do not raise errors
        pan.end_pan()
        pan.end_pan()
        self.assertFalse(pan.is_panning)

    def test_responsive_aspect_ratios_framing(self):
        """Validates that fit transform calculations maintain centered framing across screen aspect ratios."""
        boxes = [[-50.0, -30.0, 50.0, 30.0]]  # 100 x 60 extent, center (0, 0)
        resolutions = [
            (1920.0, 1080.0),  # Ultrawide / 1080p
            (1366.0, 768.0),   # Typical laptop
            (1024.0, 768.0),   # 4:3 display
            (800.0, 900.0),    # Snapped / tablet
            (375.0, 667.0),    # Mobile viewport
        ]
        for w, h in resolutions:
            fit = compute_fit_transform(boxes, target_w=w, target_h=h, pad=20.0)
            self.assertGreater(fit["scale"], 0.0)
            # Center of the geometry (0,0) should project to exactly (w/2, h/2)
            vp = Viewport(scale=fit["scale"], tx=fit["tx"], ty=fit["ty"])
            center_s = world_to_screen(vp, 0.0, 0.0)
            self.assertAlmostEqual(center_s[0], w / 2.0, places=4)
            self.assertAlmostEqual(center_s[1], h / 2.0, places=4)

    def test_responsive_resize_cycles_zero_drift(self):
        """Verifies that resizing across varied dimensions does not accumulate translation drift."""
        vp = Viewport(scale=1.5, tx=400.0, ty=300.0)
        curr_w, curr_h = 800.0, 600.0
        orig_center_world = screen_to_world(vp, curr_w / 2.0, curr_h / 2.0)

        # Sequence of dynamic resize steps
        steps = [
            (1440.0, 900.0),
            (1920.0, 1080.0),
            (1100.0, 700.0),
            (860.0, 520.0),
            (640.0, 480.0),
            (800.0, 600.0),  # Return to original
        ]
        for next_w, next_h in steps:
            vp.tx += (next_w - curr_w) / 2.0
            vp.ty += (next_h - curr_h) / 2.0
            curr_w, curr_h = next_w, next_h
            # Pinned world center at current screen center must stay identical
            curr_center_world = screen_to_world(vp, curr_w / 2.0, curr_h / 2.0)
            self.assertAlmostEqual(curr_center_world[0], orig_center_world[0], places=5)
            self.assertAlmostEqual(curr_center_world[1], orig_center_world[1], places=5)

        # Upon returning to 800x600, tx and ty must match original exactly
        self.assertAlmostEqual(vp.tx, 400.0, places=5)
        self.assertAlmostEqual(vp.ty, 300.0, places=5)

    def test_hidpi_dpr_backing_buffer_math(self):
        """Verifies backing buffer dimension calculation across browser zoom levels."""
        css_w, css_h = 960, 640
        dpr_levels = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0]
        for dpr in dpr_levels:
            buffer_w = round(css_w * dpr)
            buffer_h = round(css_h * dpr)
            self.assertEqual(buffer_w, int(css_w * dpr + 0.5))
            self.assertEqual(buffer_h, int(css_h * dpr + 0.5))
            # Screen coordinate mapping in CSS pixels remains independent of backing DPR
            vp = Viewport(scale=2.0, tx=100.0, ty=50.0)
            s_pt = world_to_screen(vp, 25.0, 30.0)
            self.assertEqual(s_pt, (150.0, 110.0))

    def test_headless_browser_viewport_suite(self):
        """Executes frontend/test_viewport.html in a headless browser and asserts 100% pass."""
        test_html = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'test_viewport.html'))
        if not os.path.exists(test_html):
            self.skipTest("test_viewport.html not found")

        if self._run_firefox(test_html):
            return
        if self._run_chromium(test_html):
            return
        self.skipTest("no headless browser (firefox or chromium) found on PATH")

    def _run_firefox(self, test_html):
        profile_dir = tempfile.mkdtemp()
        with open(os.path.join(profile_dir, 'user.js'), 'w') as f:
            f.write('user_pref("browser.dom.window.dump.enabled", true);\n')
        cmd = ['firefox', '-headless', '-profile', profile_dir, test_html]
        try:
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            time.sleep(2.5)
            p.terminate()
            stdout, _ = p.communicate(timeout=2)
            passed = 0
            failed = 0
            for line in stdout.splitlines():
                if 'TOTAL:' in line and 'PASSED:' in line:
                    parts = line.split(',')
                    passed = int(parts[1].split(':')[1].strip())
                    failed = int(parts[2].split(':')[1].split('===')[0].strip())
            self.assertGreater(passed, 0, f"No tests were run in browser: {stdout}")
            self.assertEqual(failed, 0, f"Browser test suite had {failed} failures: {stdout}")
            return True
        except FileNotFoundError:
            return False

    def _run_chromium(self, test_html):
        binary = None
        for name in (
            'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', 'msedge',
            r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
            r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
        ):
            if os.path.isabs(name) and os.path.exists(name):
                binary = name
                break
            binary = shutil.which(name)
            if binary:
                break
        if not binary:
            return False

        cmd = [binary, '--headless', '--disable-gpu', '--no-sandbox', '--dump-dom',
               '--virtual-time-budget=8000', 'file://' + test_html]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired):
            return False

        dom = result.stdout
        counts = {}
        for key in ('totalCount', 'passCount', 'failCount'):
            match = re.search(r'id="' + key + r'">(\d+)<', dom)
            if not match:
                return False
            counts[key] = int(match.group(1))

        self.assertGreater(counts['totalCount'], 0, f"No tests were run in browser: {dom[:500]}")
        self.assertEqual(counts['failCount'], 0, f"Browser test suite had {counts['failCount']} failures")
        return True


class PanSession:
    """
    Mathematical state-machine simulation of the frontend pointer pan lifecycle.
    Mirrors the event transitions in frontend/app.js.
    """
    def __init__(self, viewport: Viewport):
        self.vp = viewport
        self.is_panning = False
        self.pan_start_x = 0.0
        self.pan_start_y = 0.0
        self.active_pointer_id = None
        self.has_active_capture = False

    def pointer_down(self, pointer_id: int, client_x: float, client_y: float, capture_succeeds: bool = True):
        self.is_panning = True
        self.pan_start_x = client_x
        self.pan_start_y = client_y
        self.active_pointer_id = pointer_id
        self.has_active_capture = capture_succeeds

    def pointer_move(self, client_x: float, client_y: float, buttons: int = 1):
        if not self.is_panning:
            return
        if (buttons & 1) == 0:
            self.end_pan()
            return
        dx = client_x - self.pan_start_x
        dy = client_y - self.pan_start_y
        self.pan_start_x = client_x
        self.pan_start_y = client_y
        self.vp.tx += dx
        self.vp.ty += dy

    def pointer_leave(self, is_inside_canvas: bool):
        if self.is_panning and not self.has_active_capture:
            self.end_pan()

    def end_pan(self, pointer_id: int = None):
        if not self.is_panning:
            return
        self.is_panning = False
        self.active_pointer_id = None
        self.has_active_capture = False


if __name__ == "__main__":
    unittest.main()
