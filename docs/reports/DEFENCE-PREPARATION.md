# KESTREL - Defence Preparation

## 1. Architectural Rationale

**Why an R-tree over a QuadTree or Grid?**
KESTREL operates in a continuous, unconstrained spatial domain (the Kepler Belt). Entities are dynamic, vastly differing in dimension, and frequently cluster. An R-tree accommodates overlapping, variable-sized bounding boxes intrinsically, whereas grids suffer from boundary straddling and QuadTrees struggle with non-point data or require arbitrary depth limits. 

**Native Index Integrity vs Brute-Force Fallbacks:**
The architecture (ADR-001) mandates that the native R-tree is the sole spatial index and query mechanism. Relying on brute-force O(N) oracles to "verify" the tree implies the tree implementation is untrusted. 
- *Soundness vs Completeness Strategy:* In KESTREL, randomized tests prove *soundness* (all returned entities geometrically intersect the query geometry). To establish full *query completeness* (zero false negatives) without relying on a banned O(N) brute-force oracle, KESTREL utilizes deterministic analytical grids (where expected matching IDs are mathematically provable from spatial indexing formulas) and explicitly constructed multi-level mutation trees where ground truth is known a priori.

## 2. Algorithm Explanation

- **Node Structure & Invariants:** An `RTreeNode` is either an internal node or a leaf node. Leaves store entries containing entity IDs and their tightest `BoundingBox`. Internal nodes store child pointers (`std::unique_ptr<RTreeNode>`) and MBRs encapsulating the entire child subtree. Every node (except root) enforces capacity between `m` and `M` entries.
- **Insertion:** O(log N) average. Recursively chooses the subtree whose MBR requires minimal volume enlargement (`ChooseSubtree`). Upon reaching a leaf, the entry is inserted. If node size exceeds capacity `M`, a quadratic split partitions entries.
- **Quadratic Splitting:** Selects the pair of entries whose combination wastes the largest area (`PickSeeds`), then iteratively assigns remaining entries to the node whose MBR requires the least enlargement (`PickNext`).
- **Deletion:** O(log N) average. Traverses matching subtrees to find and remove the entry. If node occupancy falls below minimum threshold `m`, the node is eliminated and its surviving entries are re-inserted from the root (`CondenseTree`), which dynamically shrinks tree height.
- **Dynamic Updates:** When an entity moves, `rtree.update(old_b, new_b, id)` executes removal of the old bounding box followed by insertion of the new bounding box.
- **Query (Region/Nearby/Corridor):** Recursively traverses the tree. If an internal node's MBR does not intersect the broad-phase query bounding box, the entire subtree is pruned. Leaves evaluate precise geometry (narrow-phase predicate).

## 3. Complexity Claims, Empirical Measurements, and Limitations

- **Empirical Performance vs Asymptotic Complexity:** Observed wall-clock latencies (e.g., microseconds per query or milliseconds for batch updates) represent empirical performance on a specific machine; they do NOT constitute formal proof of asymptotic complexity. Hardware caching, floating-point narrow-phase evaluation, and OS thread scheduling influence timing.
- **Asymptotic Claims:** The theoretical search complexity is O(log_M N) for well-distributed, non-overlapping spatial data, degrading toward O(N) in worst-case overlapping pathological distributions.
- **Structural Profiling Evidence:** Rather than relying on latency alone, KESTREL isolates algorithmic efficiency by measuring structural traversal counters:
  - At 10,000 entities, region scans visit on average only **0.040 nodes** per query.
  - Nearby object queries visit **0.045 nodes** per query.
  - Corridor queries visit **0.164 nodes** per query, but require evaluating **1,264 narrow-phase checks** because the corridor intersects multiple candidate bounding boxes.
- **Update Limitations:** Monolithic sequential dynamic updates across all 10,000 entities take ~74 ms. For hyper-dense, high-frequency simulations (>60 Hz), localized batch updates or hybrid index structures would be recommended.

## 4. Anticipated Viva Questions

**Q1: Why did you not use an R*-tree?**
*A1:* R*-trees introduce forced reinsertion and complex margin-minimization heuristics that significantly complicate the codebase and increase update latency. For KESTREL's dynamic environment where entities move frequently, the standard R-tree with quadratic splitting offers the best balance of Minimum Necessary Implementation (MNI) and update speed.

**Q2: How do you verify query correctness and completeness without a brute-force oracle?**
*A2:* A brute-force linear scan was rejected by architectural policy to ensure the R-tree index stands on its own merits. We establish correctness through a two-part strategy:
1. *Soundness:* Asserting strict geometric intersection (`intersects()`) on every returned candidate, combined with continuous structural validation (`validate_structure()`).
2. *Completeness:* Deterministic analytical tests. We test explicitly constructed multi-level trees with known cluster arrangements under mutations (insertions, deletions with underflow, updates), and execute 1,000 queries across 10 random seeds on mathematically indexed grids where the exact set of expected matching IDs is provable independently of the index.

**Q3: How does the system ensure deterministic simulation steps?**
*A3:* The `Simulator` uses a fixed `std::mt19937` RNG sequence passed at initialization. The `EntityStore` manages unique IDs monotonically. `test_stress` proved that after 1000 steps with 10k items, structural integrity is perfectly maintained.

**Q4: Your benchmark shows corridor queries take significantly longer than region scans. Why?**
*A4:* Broad-phase pruning for corridors evaluates an oriented bounding box, and the narrow-phase geometry check requires evaluating segment-to-box distance against up to 1,264 candidate entities. Region scans only evaluate simple AABB coordinate comparisons.

**Q5: What happens if two entities occupy the exact same spatial coordinates?**
*A5:* The R-tree allows identical MBRs natively. They will be placed in the same leaf node (or split if capacity is reached). The `EntityStore` tracks them via unique sequential IDs, preventing logical collisions.

**Q6: Why is the frontend completely decoupled from the C++ core?**
*A6:* To preserve the integrity and portability of the backend. By exporting `state.json`, we fulfill `GATE-10-AC-05`, ensuring the C++ project remains purely algorithmic and compiles anywhere via CMake without demanding graphical libraries like SDL2 or SFML.

**Q7: How is the narrow-phase check isolated from the R-tree?**
*A7:* The R-tree search takes a generic `Predicate` function. `MissionControl` injects lambdas (e.g. `intersects(corridor, bounds)`) into the search, enforcing a clean separation between index traversal (broad-phase) and hazard assessment (narrow-phase).

**Q8: Did you encounter any memory leaks or undefined behavior?**
*A8:* The codebase exclusively leverages modern C++17 RAII semantics (`std::unique_ptr` for R-tree child nodes, `std::unordered_map` for entities). We attempted AddressSanitizer and UndefinedBehaviorSanitizer compilation, but the MSYS2 UCRT64 GCC 16.1.0 toolchain lacks runtime sanitizer libraries (`cannot find -lasan / -lubsan`). These criteria are honestly recorded as UNVERIFIED due to toolchain constraints.

**Q9: Why does KESTREL define its own `BoundingBox` instead of using a standard geometry library like Boost.Geometry?**
*A9:* The project follows Minimum Necessary Implementation (MNI). Including heavy header-only template libraries like Boost significantly degrades compile times and introduces cognitive overhead for a simple AABB structure.

**Q10: What is the most significant bottleneck in KESTREL's architecture?**
*A10:* The monolithic dynamic update loop. When an entity moves, it is removed and re-inserted. If 100% of a 10,000-entity dataset moves simultaneously, tree mutations take ~74 ms. Future work would investigate localized batch updates or bounding box expansion margins.
