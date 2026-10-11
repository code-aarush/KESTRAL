#include "../src/mission.h"
#include "../src/simulator.h"
#include "../src/rtree.h"
#include "../src/entity_store.h"

#include <iostream>
#include <chrono>
#include <vector>
#include <fstream>
#include <iomanip>
#include <random>

using namespace kestrel;
using namespace std::chrono;

struct BenchmarkResult {
    int num_entities;
    double build_time_ms;
    double update_time_ms;
    double region_latency_us;
    double nearby_latency_us;
    double corridor_latency_us;
    double region_nodes;
    double nearby_nodes;
    double corridor_nodes;
    double nearby_narrow;
    double corridor_narrow;
};

// We run multiple query trials to get average latency
const int QUERY_TRIALS = 1000;
const int NUM_RUNS = 5;

BenchmarkResult run_benchmark(int num_entities, unsigned int seed) {
    BenchmarkResult res{};
    res.num_entities = num_entities;

    EntityStore store;
    RTree rtree(8, 2);

    // 1. Build Phase
    auto build_start = high_resolution_clock::now();
    
    // Using a deterministic random generator for initial entity placement
    std::mt19937 gen(seed);
    std::uniform_real_distribution<double> dist(0.0, 1000.0);
    std::uniform_real_distribution<double> size_dist(1.0, 10.0);

    for (int i = 0; i < num_entities; ++i) {
        double w = size_dist(gen);
        double h = size_dist(gen);
        double x = dist(gen);
        double y = dist(gen);
        
        Entity e;
        e.id = i + 1;
        e.bounds = {x, y, x + w, y + h};
        
        store.insert(e);
        rtree.insert(e.bounds, e.id);
    }
    auto build_end = high_resolution_clock::now();
    res.build_time_ms = duration<double, std::milli>(build_end - build_start).count();

    // Verify structure after build
    if (!rtree.validate_structure()) {
        std::cerr << "R-tree structure invalid after build!\n";
    }

    // 2. Update Phase
    auto update_start = high_resolution_clock::now();
    for (int i = 1; i <= num_entities; ++i) {
        if (!store.contains(i)) continue;
        Entity e = store.get(i);
        BoundingBox old_bounds = e.bounds;
        e.bounds.min_x += 1.0;
        e.bounds.max_x += 1.0;
        e.bounds.min_y += 1.0;
        e.bounds.max_y += 1.0;
        
        rtree.update(old_bounds, e.bounds, i);
        store.update(i, e);
    }
    auto update_end = high_resolution_clock::now();
    res.update_time_ms = duration<double, std::milli>(update_end - update_start).count();

    // Verify structure after update
    if (!rtree.validate_structure()) {
        std::cerr << "R-tree structure invalid after update!\n";
    }

    // 3. Query Phase
    MissionControl mission(rtree, store);

    // Prepare deterministic queries
    std::vector<BoundingBox> region_queries;
    std::vector<BoundingBox> nearby_targets;
    std::vector<Corridor> corridor_queries;

    std::mt19937 qgen(seed + 2);
    for (int i = 0; i < QUERY_TRIALS; ++i) {
        double rx = dist(qgen);
        double ry = dist(qgen);
        region_queries.push_back({rx, ry, rx + 100, ry + 100}); // 10% of space area approx

        double nx = dist(qgen);
        double ny = dist(qgen);
        nearby_targets.push_back({nx, ny, nx + 10, ny + 10});

        double cx1 = dist(qgen);
        double cy1 = dist(qgen);
        double cx2 = dist(qgen);
        double cy2 = dist(qgen);
        corridor_queries.push_back({LineSegment{{cx1, cy1}, {cx2, cy2}}, 10.0});
    }

    // Region Queries
    MissionControl::MissionMetrics m_region;
    auto req_start = high_resolution_clock::now();
    for (const auto& q : region_queries) {
        mission.region_scan(q, &m_region);
    }
    auto req_end = high_resolution_clock::now();
    res.region_latency_us = duration<double, std::micro>(req_end - req_start).count() / QUERY_TRIALS;
    res.region_nodes = static_cast<double>(m_region.nodes_visited) / QUERY_TRIALS;

    // Nearby Queries
    MissionControl::MissionMetrics m_nearby;
    auto near_start = high_resolution_clock::now();
    for (const auto& q : nearby_targets) {
        mission.nearby_objects(q, 50.0, &m_nearby);
    }
    auto near_end = high_resolution_clock::now();
    res.nearby_latency_us = duration<double, std::micro>(near_end - near_start).count() / QUERY_TRIALS;
    res.nearby_nodes = static_cast<double>(m_nearby.nodes_visited) / QUERY_TRIALS;
    res.nearby_narrow = static_cast<double>(m_nearby.narrow_phase_checks) / QUERY_TRIALS;

    // Corridor Queries
    MissionControl::MissionMetrics m_corridor;
    auto cor_start = high_resolution_clock::now();
    for (const auto& q : corridor_queries) {
        mission.corridor_query(q, &m_corridor);
    }
    auto cor_end = high_resolution_clock::now();
    res.corridor_latency_us = duration<double, std::micro>(cor_end - cor_start).count() / QUERY_TRIALS;
    res.corridor_nodes = static_cast<double>(m_corridor.nodes_visited) / QUERY_TRIALS;
    res.corridor_narrow = static_cast<double>(m_corridor.narrow_phase_checks) / QUERY_TRIALS;

    return res;
}

int main() {
    std::vector<int> sizes = {100, 1000, 10000};
    
    // Ensure docs/reports directory exists (we'll assume the script is run from project root, 
    // but C++ doesn't create dirs easily without filesystem library which might be C++17 but can be finicky.
    // We will just write to a local file or standard out, and redirect in cmake/test).
    std::cout << "size,build_ms,update_ms,region_us,region_nodes,nearby_us,nearby_nodes,nearby_narrow,corridor_us,corridor_nodes,corridor_narrow\n";

    for (int size : sizes) {
        BenchmarkResult avg{};
        
        for (int run = 0; run < NUM_RUNS; ++run) {
            BenchmarkResult run_res = run_benchmark(size, 42 + run);
            
            avg.build_time_ms += run_res.build_time_ms;
            avg.update_time_ms += run_res.update_time_ms;
            avg.region_latency_us += run_res.region_latency_us;
            avg.nearby_latency_us += run_res.nearby_latency_us;
            avg.corridor_latency_us += run_res.corridor_latency_us;
            
            avg.region_nodes += run_res.region_nodes;
            avg.nearby_nodes += run_res.nearby_nodes;
            avg.corridor_nodes += run_res.corridor_nodes;
            
            avg.nearby_narrow += run_res.nearby_narrow;
            avg.corridor_narrow += run_res.corridor_narrow;
        }

        // Average over runs
        avg.build_time_ms /= NUM_RUNS;
        avg.update_time_ms /= NUM_RUNS;
        avg.region_latency_us /= NUM_RUNS;
        avg.nearby_latency_us /= NUM_RUNS;
        avg.corridor_latency_us /= NUM_RUNS;
        avg.region_nodes /= NUM_RUNS;
        avg.nearby_nodes /= NUM_RUNS;
        avg.corridor_nodes /= NUM_RUNS;
        avg.nearby_narrow /= NUM_RUNS;
        avg.corridor_narrow /= NUM_RUNS;

        std::cout << size << ","
                  << std::fixed << std::setprecision(3)
                  << avg.build_time_ms << ","
                  << avg.update_time_ms << ","
                  << avg.region_latency_us << ","
                  << avg.region_nodes << ","
                  << avg.nearby_latency_us << ","
                  << avg.nearby_nodes << ","
                  << avg.nearby_narrow << ","
                  << avg.corridor_latency_us << ","
                  << avg.corridor_nodes << ","
                  << avg.corridor_narrow << "\n";
    }

    return 0;
}
