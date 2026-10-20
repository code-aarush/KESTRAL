#!/usr/bin/env python3
"""
Unit and regression tests for KESTREL R-tree Hierarchy Normalization and Validation.
Tests schema ingestion, cycle detection, duplicate node IDs, parent-child consistency,
empty trees, legacy compatibility, and headless browser execution.
"""

import os
import json
import math
import tempfile
import subprocess
import time
import unittest


MAX_HIERARCHY_DEPTH = 100


def world_to_screen(scale, tx, ty, wx, wy):
    """Pure-function projection matching frontend/app.js worldToScreen."""
    if not (math.isfinite(wx) and math.isfinite(wy) and math.isfinite(scale) and math.isfinite(tx) and math.isfinite(ty)):
        return (math.nan, math.nan)
    return (wx * scale + tx, wy * scale + ty)


def project_box(bounds, scale=1.0, tx=0.0, ty=0.0):
    """Pure-function bounding box projection matching frontend/app.js projectBox."""
    if not isinstance(bounds, (list, tuple)) or len(bounds) < 4:
        return None
    x1, x2 = min(bounds[0], bounds[2]), max(bounds[0], bounds[2])
    y1, y2 = min(bounds[1], bounds[3]), max(bounds[1], bounds[3])
    if not all(math.isfinite(v) for v in (x1, x2, y1, y2, scale, tx, ty)):
        return None
    p1 = world_to_screen(scale, tx, ty, x1, y1)
    p2 = world_to_screen(scale, tx, ty, x2, y2)
    if not (math.isfinite(p1[0]) and math.isfinite(p1[1]) and math.isfinite(p2[0]) and math.isfinite(p2[1])):
        return None
    return {
        'x': min(p1[0], p2[0]),
        'y': min(p1[1], p2[1]),
        'w': abs(p2[0] - p1[0]),
        'h': abs(p2[1] - p1[1])
    }


def validate_and_normalize_hierarchy(state):
    """
    Python reference implementation of the frontend hierarchy normalization/validation layer.
    Validates identical invariants to frontend/app.js.
    """
    if not state or not isinstance(state, dict):
        return {
            'status': 'unavailable',
            'error': None,
            'message': 'State object missing or invalid',
            'root': None,
            'node_map': {},
            'entity_node_map': {},
            'total_nodes': 0,
            'max_depth': 0
        }

    rtree = state.get('rtree')
    if not isinstance(rtree, dict) or 'root' not in rtree or rtree['root'] is None and 'root' not in rtree:
        return {
            'status': 'unavailable',
            'error': None,
            'message': 'No hierarchy data present in dataset (legacy format)',
            'root': None,
            'node_map': {},
            'entity_node_map': {},
            'total_nodes': 0,
            'max_depth': 0
        }

    raw_root = rtree['root']
    if raw_root is None:
        return {
            'status': 'empty',
            'error': None,
            'message': 'R-tree hierarchy is empty',
            'root': None,
            'node_map': {},
            'entity_node_map': {},
            'total_nodes': 0,
            'max_depth': 0
        }

    if not isinstance(raw_root, dict):
        return {
            'status': 'invalid',
            'error': 'Hierarchy root must be an object or null',
            'root': None,
            'node_map': {},
            'entity_node_map': {},
            'total_nodes': 0,
            'max_depth': 0
        }

    visited_ids = set()
    ancestor_ids = set()
    node_map = {}
    entity_node_map = {}
    stats = {'internal': 0, 'leaf': 0, 'entity': 0, 'max_depth': 0}

    def validate_bounds(bounds, node_id):
        if not isinstance(bounds, (list, tuple)) or len(bounds) != 4:
            return f'Node "{node_id}" bounds must be an array of 4 numbers'
        for i, val in enumerate(bounds):
            if isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val):
                return f'Node "{node_id}" contains non-finite coordinate at bounds[{i}]'
        if bounds[0] > bounds[2]:
            return f'Node "{node_id}" bounds min_x ({bounds[0]}) > max_x ({bounds[2]})'
        if bounds[1] > bounds[3]:
            return f'Node "{node_id}" bounds min_y ({bounds[1]}) > max_y ({bounds[3]})'
        return None

    def process_node(raw_node, expected_parent_id, current_depth, is_root):
        if not isinstance(raw_node, dict):
            return {'error': f'Encountered null or non-object node at depth {current_depth}'}

        if current_depth > MAX_HIERARCHY_DEPTH:
            return {'error': f'Hierarchy depth exceeded maximum safe limit ({MAX_HIERARCHY_DEPTH})'}

        node_id = raw_node.get('id')
        if not isinstance(node_id, str) or not node_id.strip():
            return {'error': f'Node at depth {current_depth} is missing a valid string ID'}

        if node_id in ancestor_ids:
            return {'error': f'Cycle detected: node "{node_id}" is an ancestor of itself'}

        if node_id in visited_ids:
            return {'error': f'Duplicate node ID: "{node_id}" appears multiple times in tree'}

        visited_ids.add(node_id)
        ancestor_ids.add(node_id)

        # Parent-child consistency
        if is_root:
            if raw_node.get('parent_id') is not None:
                return {'error': f'Root node "{node_id}" cannot specify a non-null parent_id'}
        else:
            parent_id = raw_node.get('parent_id')
            if parent_id is not None and parent_id != expected_parent_id:
                return {'error': f'Parent-child inconsistency: node "{node_id}" has parent_id "{parent_id}", expected "{expected_parent_id}"'}

        # Node type
        node_type = raw_node.get('type')
        if node_type not in ('root', 'internal', 'leaf', 'entity'):
            return {'error': f'Node "{node_id}" has invalid type "{node_type}"'}

        if is_root and node_type not in ('root', 'leaf'):
            return {'error': f'Root node "{node_id}" must have type "root" or "leaf"'}

        # Bounds validation
        bounds_err = validate_bounds(raw_node.get('bounds'), node_id)
        if bounds_err:
            return {'error': bounds_err}

        if node_type == 'entity':
            entity_id = raw_node.get('entity_id')
            if not isinstance(entity_id, int) or entity_id <= 0:
                return {'error': f'Entity node "{node_id}" must have a positive integer entity_id'}
            if raw_node.get('children'):
                return {'error': f'Entity node "{node_id}" cannot contain child nodes'}

            stats['entity'] += 1
            stats['max_depth'] = max(stats['max_depth'], current_depth)

            normalized = {
                'id': node_id,
                'parent_id': expected_parent_id,
                'type': 'entity',
                'is_root': False,
                'is_leaf': False,
                'depth': current_depth,
                'bounds': list(raw_node['bounds']),
                'entity_id': entity_id,
                'children': []
            }
            node_map[node_id] = normalized
            entity_node_map[entity_id] = normalized
            ancestor_ids.remove(node_id)
            return {'node': normalized}

        is_leaf = (node_type == 'leaf') or (is_root and raw_node.get('is_leaf') is True)
        if is_leaf:
            stats['leaf'] += 1
        else:
            stats['internal'] += 1

        stats['max_depth'] = max(stats['max_depth'], current_depth)

        raw_children = raw_node.get('children')
        if not isinstance(raw_children, list):
            return {'error': f'Node "{node_id}" ({node_type}) must have an array of children'}

        normalized_children = []
        for i, child in enumerate(raw_children):
            if not isinstance(child, dict):
                return {'error': f'Node "{node_id}" has dangling/null child reference at index {i}'}

            child_type = child.get('type')
            if is_leaf:
                if child_type != 'entity':
                    return {'error': f'Leaf node "{node_id}" cannot have non-entity child (type: {child_type})'}
            else:
                if child_type == 'entity':
                    return {'error': f'Internal node "{node_id}" cannot directly contain entity child'}

            res = process_node(child, node_id, current_depth + 1, False)
            if 'error' in res:
                return res
            normalized_children.append(res['node'])

        normalized = {
            'id': node_id,
            'parent_id': expected_parent_id,
            'type': 'root' if is_root else ('leaf' if is_leaf else 'internal'),
            'is_root': bool(is_root),
            'is_leaf': is_leaf,
            'depth': current_depth,
            'bounds': list(raw_node['bounds']),
            'entity_id': None,
            'children': normalized_children
        }
        node_map[node_id] = normalized
        ancestor_ids.remove(node_id)
        return {'node': normalized}

    root_res = process_node(raw_root, None, 0, True)
    if 'error' in root_res:
        return {
            'status': 'invalid',
            'error': root_res['error'],
            'root': None,
            'node_map': {},
            'entity_node_map': {},
            'total_nodes': 0,
            'max_depth': 0
        }

    norm_root = root_res['node']
    is_empty = norm_root['is_leaf'] and len(norm_root['children']) == 0

    return {
        'status': 'empty' if is_empty else 'valid',
        'error': None,
        'message': 'R-tree hierarchy is empty' if is_empty else 'R-tree hierarchy loaded successfully',
        'root': norm_root,
        'node_map': node_map,
        'entity_node_map': entity_node_map,
        'total_nodes': len(visited_ids),
        'internal_nodes': stats['internal'],
        'leaf_nodes': stats['leaf'],
        'entity_nodes': stats['entity'],
        'max_depth': stats['max_depth']
    }


class TestHierarchyValidation(unittest.TestCase):

    def setUp(self):
        # Load canonical state.json generated by C++ exporter
        state_path = os.path.join(os.path.dirname(__file__), '..', 'state.json')
        if os.path.exists(state_path):
            with open(state_path, 'r') as f:
                self.canonical_state = json.load(f)
        else:
            self.canonical_state = None

    def test_canonical_exported_hierarchy(self):
        """Verifies that the actual C++ exported state.json is accepted and valid."""
        if not self.canonical_state:
            self.skipTest("state.json not found")

        result = validate_and_normalize_hierarchy(self.canonical_state)
        self.assertEqual(result['status'], 'valid')
        self.assertIsNone(result['error'])
        self.assertIsNotNone(result['root'])
        self.assertEqual(result['root']['id'], 'node_0')
        self.assertEqual(result['root']['type'], 'root')
        self.assertGreater(result['total_nodes'], 1)
        self.assertEqual(result['entity_nodes'], len(self.canonical_state['entities']))
        self.assertEqual(len(result['entity_node_map']), len(self.canonical_state['entities']))

    def test_legacy_format_backward_compatibility(self):
        """Verifies that datasets without 'root' hierarchy are gracefully marked unavailable."""
        legacy_state = {
            'entities': [{'id': 1, 'bounds': [0, 0, 10, 10]}],
            'query': {'bounds': [0, 0, 10, 10], 'results': [1]},
            'rtree': {
                'internal_mbrs': [[0, 0, 10, 10]],
                'leaf_mbrs': [[0, 0, 10, 10]]
            }
        }
        result = validate_and_normalize_hierarchy(legacy_state)
        self.assertEqual(result['status'], 'unavailable')
        self.assertIsNone(result['error'])
        self.assertIsNone(result['root'])
        self.assertEqual(result['total_nodes'], 0)

    def test_empty_hierarchy_distinction(self):
        """Verifies distinction between valid empty hierarchy and malformed data."""
        # 1. Null root
        result_null = validate_and_normalize_hierarchy({'rtree': {'root': None}})
        self.assertEqual(result_null['status'], 'empty')

        # 2. Empty leaf root
        empty_root = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': True,
                    'depth': 0,
                    'bounds': [0, 0, 0, 0],
                    'children': []
                }
            }
        }
        result_empty = validate_and_normalize_hierarchy(empty_root)
        self.assertEqual(result_empty['status'], 'empty')
        self.assertEqual(result_empty['total_nodes'], 1)

    def test_duplicate_node_ids_detected(self):
        """Verifies duplicate node IDs produce status 'invalid'."""
        bad_state = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [0, 0, 10, 10],
                    'children': [
                        {
                            'id': 'node_1',
                            'parent_id': 'node_0',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [0, 0, 5, 5],
                            'children': []
                        },
                        {
                            'id': 'node_1',  # Duplicate!
                            'parent_id': 'node_0',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [5, 5, 10, 10],
                            'children': []
                        }
                    ]
                }
            }
        }
        result = validate_and_normalize_hierarchy(bad_state)
        self.assertEqual(result['status'], 'invalid')
        self.assertIn('Duplicate node ID', result['error'])

    def test_cycle_detection(self):
        """Verifies cycle produces status 'invalid' without hanging."""
        bad_state = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [0, 0, 10, 10],
                    'children': [
                        {
                            'id': 'node_0',  # Cycle back to root!
                            'parent_id': 'node_0',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [0, 0, 10, 10],
                            'children': []
                        }
                    ]
                }
            }
        }
        result = validate_and_normalize_hierarchy(bad_state)
        self.assertEqual(result['status'], 'invalid')
        self.assertIn('Cycle detected', result['error'])

    def test_non_finite_bounds_detected(self):
        """Verifies NaN or infinite bounds produce status 'invalid'."""
        bad_state = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': True,
                    'depth': 0,
                    'bounds': [float('nan'), 0, 10, 10],
                    'children': []
                }
            }
        }
        result = validate_and_normalize_hierarchy(bad_state)
        self.assertEqual(result['status'], 'invalid')
        self.assertIn('non-finite coordinate', result['error'])

    def test_inverted_bounds_detected(self):
        """Verifies min_x > max_x produces status 'invalid'."""
        bad_state = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': True,
                    'depth': 0,
                    'bounds': [100, 0, 10, 10],
                    'children': []
                }
            }
        }
        result = validate_and_normalize_hierarchy(bad_state)
        self.assertEqual(result['status'], 'invalid')
        self.assertIn('min_x (100) > max_x (10)', result['error'])

    def test_parent_child_inconsistency_detected(self):
        """Verifies mismatched parent_id produces status 'invalid'."""
        bad_state = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [0, 0, 10, 10],
                    'children': [
                        {
                            'id': 'node_1',
                            'parent_id': 'wrong_parent',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [0, 0, 10, 10],
                            'children': []
                        }
                    ]
                }
            }
        }
        result = validate_and_normalize_hierarchy(bad_state)
        self.assertEqual(result['status'], 'invalid')
        self.assertIn('Parent-child inconsistency', result['error'])

    def test_multi_level_hierarchy(self):
        """Verifies deep 3-level hierarchy (root -> internal -> leaf -> entity)."""
        multi_level = {
            'rtree': {
                'root': {
                    'id': 'lvl0_root',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [10, 10, 50, 50],
                    'children': [
                        {
                            'id': 'lvl1_internal',
                            'parent_id': 'lvl0_root',
                            'type': 'internal',
                            'is_root': False,
                            'is_leaf': False,
                            'depth': 1,
                            'bounds': [10, 10, 30, 30],
                            'children': [
                                {
                                    'id': 'lvl2_leaf',
                                    'parent_id': 'lvl1_internal',
                                    'type': 'leaf',
                                    'is_root': False,
                                    'is_leaf': True,
                                    'depth': 2,
                                    'bounds': [15, 15, 25, 25],
                                    'children': [
                                        {
                                            'id': 'lvl3_entity',
                                            'parent_id': 'lvl2_leaf',
                                            'entity_id': 77,
                                            'type': 'entity',
                                            'bounds': [15, 15, 25, 25]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        }
        res = validate_and_normalize_hierarchy(multi_level)
        self.assertEqual(res['status'], 'valid')
        self.assertEqual(res['max_depth'], 3)
        self.assertEqual(res['total_nodes'], 4)
        self.assertEqual(res['entity_nodes'], 1)

    def test_empty_leaf_child_in_internal_node(self):
        """Verifies internal node containing an empty leaf child alongside populated leaf."""
        mixed = {
            'rtree': {
                'root': {
                    'id': 'mix_root',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [0, 0, 100, 100],
                    'children': [
                        {
                            'id': 'empty_leaf',
                            'parent_id': 'mix_root',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [0, 0, 10, 10],
                            'children': []
                        },
                        {
                            'id': 'full_leaf',
                            'parent_id': 'mix_root',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [60, 60, 70, 70],
                            'children': [
                                {
                                    'id': 'entity_50',
                                    'parent_id': 'full_leaf',
                                    'entity_id': 50,
                                    'type': 'entity',
                                    'bounds': [60, 60, 70, 70]
                                }
                            ]
                        }
                    ]
                }
            }
        }
        res = validate_and_normalize_hierarchy(mixed)
        self.assertEqual(res['status'], 'valid')
        self.assertEqual(res['total_nodes'], 4)
        self.assertEqual(res['leaf_nodes'], 2)
        self.assertEqual(res['entity_nodes'], 1)

    def test_no_entity_references_in_hierarchy(self):
        """Verifies hierarchy with internal and leaf nodes but 0 entities."""
        no_ent = {
            'rtree': {
                'root': {
                    'id': 'no_ent_root',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [0, 0, 50, 50],
                    'children': [
                        {
                            'id': 'leaf_1',
                            'parent_id': 'no_ent_root',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [0, 0, 20, 20],
                            'children': []
                        },
                        {
                            'id': 'leaf_2',
                            'parent_id': 'no_ent_root',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [25, 25, 50, 50],
                            'children': []
                        }
                    ]
                }
            }
        }
        res = validate_and_normalize_hierarchy(no_ent)
        self.assertEqual(res['status'], 'valid')
        self.assertEqual(res['total_nodes'], 3)
        self.assertEqual(res['entity_nodes'], 0)

    def test_missing_and_non_object_rtree_payloads(self):
        """Verifies strings, numbers, booleans, arrays, nulls, and missing rtree produce unavailable."""
        self.assertEqual(validate_and_normalize_hierarchy({})['status'], 'unavailable')
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': None})['status'], 'unavailable')
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': 'corrupted'})['status'], 'unavailable')
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': 42})['status'], 'unavailable')
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': True})['status'], 'unavailable')
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': []})['status'], 'unavailable')

    def test_invalid_root_references(self):
        """Verifies invalid root primitives produce status invalid."""
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': {'root': 'node_0'}})['status'], 'invalid')
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': {'root': 12345}})['status'], 'invalid')
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': {'root': []}})['status'], 'invalid')
        self.assertEqual(validate_and_normalize_hierarchy({'rtree': {'root': True}})['status'], 'invalid')
        empty_obj_res = validate_and_normalize_hierarchy({'rtree': {'root': {}}})
        self.assertEqual(empty_obj_res['status'], 'invalid')
        self.assertIn('missing a valid string ID', empty_obj_res['error'])

    def test_invalid_bounds_variants(self):
        """Verifies 3-element bounds, non-numeric bounds, and infinity coordinates produce invalid."""
        base = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': True,
                    'depth': 0,
                    'bounds': [0, 0, 10],  # 3 elements
                    'children': []
                }
            }
        }
        res3 = validate_and_normalize_hierarchy(base)
        self.assertEqual(res3['status'], 'invalid')
        self.assertIn('bounds must be an array of 4 numbers', res3['error'])

        base['rtree']['root']['bounds'] = [0, '10', 20, 20]
        res_str = validate_and_normalize_hierarchy(base)
        self.assertEqual(res_str['status'], 'invalid')

        base['rtree']['root']['bounds'] = [0, float('inf'), 20, 20]
        res_inf = validate_and_normalize_hierarchy(base)
        self.assertEqual(res_inf['status'], 'invalid')
        self.assertIn('non-finite coordinate', res_inf['error'])

    def test_entity_not_in_entities_list(self):
        """Verifies hierarchy validation succeeds even when entity is absent from entities list."""
        state = {
            'entities': [{'id': 1, 'bounds': [0, 0, 10, 10]}],
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': True,
                    'depth': 0,
                    'bounds': [50, 50, 60, 60],
                    'children': [
                        {
                            'id': 'entity_999',
                            'parent_id': 'node_0',
                            'entity_id': 999,
                            'type': 'entity',
                            'bounds': [50, 50, 60, 60]
                        }
                    ]
                }
            }
        }
        res = validate_and_normalize_hierarchy(state)
        self.assertEqual(res['status'], 'valid')
        self.assertIn(999, res['entity_node_map'])

    def test_dangling_child_reference_detected(self):
        """Verifies null or non-object child in children array produces status invalid."""
        dangling_state = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [0, 0, 10, 10],
                    'children': [
                        None  # Dangling/null reference!
                    ]
                }
            }
        }
        res = validate_and_normalize_hierarchy(dangling_state)
        self.assertEqual(res['status'], 'invalid')
        self.assertIn('dangling/null child reference', res['error'])

    def test_internal_and_leaf_classification_invariants(self):
        """Verifies strict classification constraints between internal, leaf, and entity nodes."""
        # 1. Internal node directly containing entity child
        internal_with_entity = {
            'rtree': {
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [0, 0, 10, 10],
                    'children': [
                        {
                            'id': 'entity_1',
                            'parent_id': 'node_0',
                            'entity_id': 1,
                            'type': 'entity',
                            'bounds': [0, 0, 5, 5]
                        }
                    ]
                }
            }
        }
        res1 = validate_and_normalize_hierarchy(internal_with_entity)
        self.assertEqual(res1['status'], 'invalid')
        self.assertIn('cannot directly contain entity child', res1['error'])

        # 2. Leaf node containing non-entity child
        leaf_with_internal = {
            'rtree': {
                'root': {
                    'id': 'leaf_0',
                    'parent_id': None,
                    'type': 'leaf',
                    'is_root': True,
                    'is_leaf': True,
                    'depth': 0,
                    'bounds': [0, 0, 10, 10],
                    'children': [
                        {
                            'id': 'sub_leaf',
                            'parent_id': 'leaf_0',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [0, 0, 5, 5],
                            'children': []
                        }
                    ]
                }
            }
        }
        res2 = validate_and_normalize_hierarchy(leaf_with_internal)
        self.assertEqual(res2['status'], 'invalid')
        self.assertIn('cannot have non-entity child', res2['error'])

        # 3. Entity node containing children
        entity_with_children = {
            'rtree': {
                'root': {
                    'id': 'leaf_root',
                    'parent_id': None,
                    'type': 'leaf',
                    'is_root': True,
                    'is_leaf': True,
                    'depth': 0,
                    'bounds': [0, 0, 10, 10],
                    'children': [
                        {
                            'id': 'entity_bad',
                            'parent_id': 'leaf_root',
                            'entity_id': 1,
                            'type': 'entity',
                            'bounds': [0, 0, 5, 5],
                            'children': [{'id': 'illegal'}]
                        }
                    ]
                }
            }
        }
        res3 = validate_and_normalize_hierarchy(entity_with_children)
        self.assertEqual(res3['status'], 'invalid')
        self.assertIn('cannot contain child nodes', res3['error'])

    def test_child_traversal_order_and_stability(self):
        """Verifies deterministic node ID generation and stable traversal preservation."""
        tree = {
            'rtree': {
                'root': {
                    'id': 'root_node',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': False,
                    'depth': 0,
                    'bounds': [0, 0, 100, 100],
                    'children': [
                        {
                            'id': 'child_alpha',
                            'parent_id': 'root_node',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [0, 0, 40, 40],
                            'children': [
                                {'id': 'entity_1', 'parent_id': 'child_alpha', 'entity_id': 1, 'type': 'entity', 'bounds': [0, 0, 10, 10]}
                            ]
                        },
                        {
                            'id': 'child_beta',
                            'parent_id': 'root_node',
                            'type': 'leaf',
                            'is_root': False,
                            'is_leaf': True,
                            'depth': 1,
                            'bounds': [50, 50, 90, 90],
                            'children': [
                                {'id': 'entity_2', 'parent_id': 'child_beta', 'entity_id': 2, 'type': 'entity', 'bounds': [50, 50, 60, 60]}
                            ]
                        }
                    ]
                }
            }
        }
        run1 = validate_and_normalize_hierarchy(tree)
        run2 = validate_and_normalize_hierarchy(tree)
        self.assertEqual(run1['total_nodes'], run2['total_nodes'])
        self.assertEqual(list(run1['node_map'].keys()), list(run2['node_map'].keys()))
        self.assertEqual([c['id'] for c in run1['root']['children']], ['child_alpha', 'child_beta'])
        self.assertEqual([c['id'] for c in run2['root']['children']], ['child_alpha', 'child_beta'])

    def test_selected_node_mbr_projection(self):
        """Pure-function test: validates projecting hierarchy node MBR through viewport transform."""
        node_bounds = [10.0, 20.0, 50.0, 80.0]
        scale = 2.0
        tx = 100.0
        ty = 50.0

        # Base projection
        proj = project_box(node_bounds, scale=scale, tx=tx, ty=ty)
        self.assertIsNotNone(proj)
        self.assertAlmostEqual(proj['x'], 10.0 * 2.0 + 100.0)  # 120.0
        self.assertAlmostEqual(proj['y'], 20.0 * 2.0 + 50.0)   # 90.0
        self.assertAlmostEqual(proj['w'], (50.0 - 10.0) * 2.0)  # 80.0
        self.assertAlmostEqual(proj['h'], (80.0 - 20.0) * 2.0)  # 120.0

        # Zoom invariance: factor 1.5
        new_scale = scale * 1.5
        proj_zoom = project_box(node_bounds, scale=new_scale, tx=tx, ty=ty)
        self.assertAlmostEqual(proj_zoom['w'], proj['w'] * 1.5)
        self.assertAlmostEqual(proj_zoom['h'], proj['h'] * 1.5)

        # Pan invariance: shift tx by +40, ty by +25
        proj_pan = project_box(node_bounds, scale=scale, tx=tx + 40.0, ty=ty + 25.0)
        self.assertAlmostEqual(proj_pan['x'], proj['x'] + 40.0)
        self.assertAlmostEqual(proj_pan['y'], proj['y'] + 25.0)
        self.assertAlmostEqual(proj_pan['w'], proj['w'])
        self.assertAlmostEqual(proj_pan['h'], proj['h'])

        # Degenerate point box
        proj_pt = project_box([30.0, 40.0, 30.0, 40.0], scale=scale, tx=tx, ty=ty)
        self.assertIsNotNone(proj_pt)
        self.assertEqual(proj_pt['w'], 0.0)
        self.assertEqual(proj_pt['h'], 0.0)

        # Non-finite and invalid bounds
        self.assertIsNone(project_box([math.nan, 0, 10, 10]))
        self.assertIsNone(project_box([0, 0, 10]))
        self.assertIsNone(project_box(None))

    def test_map_and_viewport_preservation_with_hierarchy(self):
        """Verifies state entities and query remain unaltered alongside hierarchy validation."""
        full_state = {
            'entities': [
                {'id': 1, 'bounds': [10.0, 10.0, 20.0, 20.0]},
                {'id': 2, 'bounds': [30.0, 30.0, 40.0, 40.0]}
            ],
            'query': {
                'bounds': [0.0, 0.0, 50.0, 50.0],
                'results': [1]
            },
            'rtree': {
                'internal_mbrs': [[10.0, 10.0, 40.0, 40.0]],
                'leaf_mbrs': [[10.0, 10.0, 20.0, 20.0]],
                'root': {
                    'id': 'node_0',
                    'parent_id': None,
                    'type': 'root',
                    'is_root': True,
                    'is_leaf': True,
                    'depth': 0,
                    'bounds': [10.0, 10.0, 40.0, 40.0],
                    'children': [
                        {'id': 'entity_1', 'parent_id': 'node_0', 'entity_id': 1, 'type': 'entity', 'bounds': [10.0, 10.0, 20.0, 20.0]}
                    ]
                }
            }
        }
        res = validate_and_normalize_hierarchy(full_state)
        self.assertEqual(res['status'], 'valid')
        # Check entities and query structures are preserved
        self.assertEqual(len(full_state['entities']), 2)
        self.assertEqual(full_state['query']['results'], [1])
        self.assertEqual(len(full_state['rtree']['internal_mbrs']), 1)
        self.assertEqual(len(full_state['rtree']['leaf_mbrs']), 1)

    def test_headless_browser_suite(self):
        """Executes frontend/test_hierarchy.html in headless Firefox and asserts 100% pass."""
        test_html = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'test_hierarchy.html'))
        if not os.path.exists(test_html):
            self.skipTest("test_hierarchy.html not found")

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
        except FileNotFoundError:
            self.skipTest("firefox binary not found on PATH")


if __name__ == '__main__':
    unittest.main()
