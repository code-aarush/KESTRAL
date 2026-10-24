#include "rtree.h"
#include <stdexcept>
#include <iostream>
#include <cmath>
#include <algorithm>

namespace kestrel {

const char* to_string(RTreeTraceEventType type) {
    switch (type) {
        case RTreeTraceEventType::NodeVisited:       return "node_visited";
        case RTreeTraceEventType::MbrTested:         return "mbr_tested";
        case RTreeTraceEventType::BranchPruned:      return "branch_pruned";
        case RTreeTraceEventType::ChildEntered:      return "child_entered";
        case RTreeTraceEventType::LeafEntryExamined: return "leaf_entry_examined";
        case RTreeTraceEventType::EntityAccepted:    return "entity_accepted";
        case RTreeTraceEventType::TraversalCompleted: return "traversal_completed";
    }
    return "unknown";
}

RTree::RTree(std::size_t M, std::size_t m) : M_(M), m_(m), next_node_id_(1) {
    if (M_ < 2) {
        throw std::invalid_argument("M must be at least 2");
    }
    if (m_ > M_ / 2) {
        throw std::invalid_argument("m must be <= floor(M/2)");
    }
    root_ = make_node(true, nullptr);
}

std::unique_ptr<RTreeNode> RTree::make_node(bool leaf, RTreeNode* parent) {
    return std::make_unique<RTreeNode>(leaf, parent, next_node_id_++);
}

void RTree::set_root(std::unique_ptr<RTreeNode> new_root) {
    if (new_root && new_root->id == 0) {
        new_root->id = next_node_id_++;
    }
    root_ = std::move(new_root);
}

void RTree::insert(BoundingBox bounds, int entity_id) {
    if (!root_) {
        root_ = make_node(true, nullptr);
    }

    RTreeNode* leaf = choose_leaf(bounds);
    RTreeEntry new_entry(bounds, entity_id);

    if (leaf->entries.size() < M_) {
        leaf->entries.push_back(std::move(new_entry));
        adjust_tree(leaf, nullptr);
    } else {
        std::unique_ptr<RTreeNode> split = split_node(leaf, std::move(new_entry));
        adjust_tree(leaf, std::move(split));
    }
}

RTreeNode* RTree::find_leaf(const BoundingBox& bounds, int entity_id) const {
    if (!root_) return nullptr;
    
    std::vector<RTreeNode*> stack;
    stack.push_back(root_.get());
    
    while (!stack.empty()) {
        RTreeNode* current = stack.back();
        stack.pop_back();
        
        if (current->is_leaf) {
            for (const auto& entry : current->entries) {
                if (entry.entity_id == entity_id && 
                    contains(bounds, entry.mbr) && contains(entry.mbr, bounds)) {
                    return current;
                }
            }
        } else {
            for (const auto& entry : current->entries) {
                if (intersects(bounds, entry.mbr)) {
                    stack.push_back(entry.child.get());
                }
            }
        }
    }
    return nullptr;
}

void RTree::flatten_subtree(RTreeNode* node, std::vector<std::pair<BoundingBox, int>>& reinsert_list) const {
    if (node->is_leaf) {
        for (const auto& entry : node->entries) {
            reinsert_list.push_back({entry.mbr, entry.entity_id});
        }
    } else {
        for (const auto& entry : node->entries) {
            flatten_subtree(entry.child.get(), reinsert_list);
        }
    }
}

void RTree::condense_tree(RTreeNode* leaf, std::vector<std::pair<BoundingBox, int>>& reinsert_list) {
    RTreeNode* N = leaf;
    while (N != root_.get()) {
        RTreeNode* P = N->parent;
        
        // Find N in P
        auto it = std::find_if(P->entries.begin(), P->entries.end(),
                               [N](const RTreeEntry& e) { return e.child.get() == N; });
        
        if (N->entries.size() < m_) {
            // Eliminate N
            flatten_subtree(N, reinsert_list);
            P->entries.erase(it);
        } else {
            // Adjust MBR
            it->mbr = N->compute_mbr();
        }
        N = P;
    }
}

bool RTree::remove(const BoundingBox& bounds, int entity_id) {
    if (!root_) return false;
    
    RTreeNode* leaf = find_leaf(bounds, entity_id);
    if (!leaf) return false;
    
    auto it = std::find_if(leaf->entries.begin(), leaf->entries.end(),
                           [entity_id](const RTreeEntry& e) { return e.entity_id == entity_id; });
    if (it == leaf->entries.end()) {
        return false;
    }
    leaf->entries.erase(it);
    
    std::vector<std::pair<BoundingBox, int>> reinsert_list;
    condense_tree(leaf, reinsert_list);
    
    while (root_->entries.size() == 1 && !root_->is_leaf) {
        root_->entries[0].child->parent = nullptr;
        root_ = std::move(root_->entries[0].child);
    }
    if (root_->entries.empty()) {
        root_ = make_node(true, nullptr);
    }
    
    for (const auto& item : reinsert_list) {
        insert(item.first, item.second);
    }
    
    return true;
}

bool RTree::update(const BoundingBox& old_bounds, const BoundingBox& new_bounds, int entity_id) {
    if (remove(old_bounds, entity_id)) {
        insert(new_bounds, entity_id);
        return true;
    }
    return false;
}

std::vector<int> RTree::search(const BoundingBox& query, QueryMetrics& metrics) const {
    return search(query, metrics, nullptr);
}

std::vector<int> RTree::search(const BoundingBox& query, QueryMetrics& metrics, RTreeTrace* trace) const {
    std::vector<int> result;

    metrics.nodes_visited = 0;

    // Each trace describes exactly one query: start from a clean slate.
    if (trace) trace->clear();

    if (!query.is_valid()) {
        if (trace) {
            RTreeTraceEvent completed;
            completed.type = RTreeTraceEventType::TraversalCompleted;
            trace->events.push_back(completed);
        }
        return result;
    }

    // The recorder keeps one slot free so the terminal completion event is
    // always present, even for very large traversals.
    const std::size_t limit = trace ? std::max<std::size_t>(trace->max_events, 2) : 0;

    auto record = [&](RTreeTraceEvent event) {
        if (!trace) return;
        if (trace->events.size() + 1 >= limit) {
            trace->truncated = true;
            return;
        }
        trace->events.push_back(std::move(event));
    };

    if (!root_) {
        if (trace) {
            RTreeTraceEvent completed;
            completed.type = RTreeTraceEventType::TraversalCompleted;
            trace->events.push_back(completed);
        }
        return result;
    }

    std::vector<const RTreeNode*> stack;
    stack.push_back(root_.get());
    
    while (!stack.empty()) {
        const RTreeNode* current = stack.back();
        stack.pop_back();
        
        metrics.nodes_visited++;

        RTreeTraceEvent visited;
        visited.type = RTreeTraceEventType::NodeVisited;
        visited.node_id = current->id;
        visited.mbr = current->compute_mbr();
        visited.intersects = intersects(query, visited.mbr);
        record(visited);

        for (const auto& entry : current->entries) {
            const bool hit = intersects(query, entry.mbr);

            RTreeTraceEvent tested;
            tested.type = RTreeTraceEventType::MbrTested;
            tested.node_id = current->id;
            tested.mbr = entry.mbr;
            tested.intersects = hit;

            if (current->is_leaf) {
                tested.entity_id = entry.entity_id;
                record(tested);

                if (!hit) {
                    // The leaf entry misses the query region: nothing is collected.
                    continue;
                }

                RTreeTraceEvent examined;
                examined.type = RTreeTraceEventType::LeafEntryExamined;
                examined.node_id = current->id;
                examined.entity_id = entry.entity_id;
                examined.mbr = entry.mbr;
                examined.intersects = true;
                record(examined);

                RTreeTraceEvent accepted;
                accepted.type = RTreeTraceEventType::EntityAccepted;
                accepted.node_id = current->id;
                accepted.entity_id = entry.entity_id;
                accepted.mbr = entry.mbr;
                accepted.intersects = true;
                record(accepted);

                result.push_back(entry.entity_id);
            } else {
                tested.child_node_id = entry.child->id;
                record(tested);

                if (!hit) {
                    RTreeTraceEvent pruned;
                    pruned.type = RTreeTraceEventType::BranchPruned;
                    pruned.node_id = current->id;
                    pruned.child_node_id = entry.child->id;
                    pruned.mbr = entry.mbr;
                    pruned.intersects = false;
                    record(pruned);
                    continue;
                }

                RTreeTraceEvent entered;
                entered.type = RTreeTraceEventType::ChildEntered;
                entered.node_id = current->id;
                entered.child_node_id = entry.child->id;
                entered.mbr = entry.mbr;
                entered.intersects = true;
                record(entered);

                stack.push_back(entry.child.get());
            }
        }
    }

    if (trace) {
        RTreeTraceEvent completed;
        completed.type = RTreeTraceEventType::TraversalCompleted;
        completed.node_id = 0;
        completed.entity_id = -1;
        completed.mbr = BoundingBox{0, 0, 0, 0};
        completed.intersects = false;
        trace->events.push_back(completed);
    }

    return result;
}

RTreeNode* RTree::choose_leaf(const BoundingBox& bounds) const {
    RTreeNode* current = root_.get();
    while (!current->is_leaf) {
        RTreeNode* best_child = nullptr;
        double min_enlargement = -1.0;
        double min_area = -1.0;

        for (auto& entry : current->entries) {
            double current_area = area(entry.mbr);
            double enl = enlargement(entry.mbr, bounds);

            if (best_child == nullptr || enl < min_enlargement || 
               (enl == min_enlargement && current_area < min_area)) {
                best_child = entry.child.get();
                min_enlargement = enl;
                min_area = current_area;
            }
        }
        current = best_child;
    }
    return current;
}

std::unique_ptr<RTreeNode> RTree::split_node(RTreeNode* node, RTreeEntry&& new_entry) {
    std::vector<RTreeEntry> all_entries;
    for (auto& e : node->entries) {
        all_entries.push_back(std::move(e));
    }
    all_entries.push_back(std::move(new_entry));
    node->entries.clear();

    size_t seed1 = 0, seed2 = 0;
    double max_dead_area = -1.0;
    long long best_id1 = -1, best_id2 = -1;

    for (size_t i = 0; i < all_entries.size(); ++i) {
        for (size_t j = i + 1; j < all_entries.size(); ++j) {
            double a_union = area(union_of(all_entries[i].mbr, all_entries[j].mbr));
            double dead_area = a_union - area(all_entries[i].mbr) - area(all_entries[j].mbr);

            long long id1 = node->is_leaf ? all_entries[i].entity_id : i;
            long long id2 = node->is_leaf ? all_entries[j].entity_id : j;
            if (id1 > id2) std::swap(id1, id2);

            bool update = false;
            if (max_dead_area < 0 || dead_area > max_dead_area) {
                update = true;
            } else if (dead_area == max_dead_area) {
                if (best_id1 == -1 || id1 < best_id1 || (id1 == best_id1 && id2 < best_id2)) {
                    update = true;
                }
            }

            if (update) {
                max_dead_area = dead_area;
                seed1 = i;
                seed2 = j;
                best_id1 = id1;
                best_id2 = id2;
            }
        }
    }

    auto new_node = make_node(node->is_leaf, node->parent);
    
    node->entries.push_back(std::move(all_entries[seed1]));
    if (!node->is_leaf) node->entries.back().child->parent = node;
    
    new_node->entries.push_back(std::move(all_entries[seed2]));
    if (!new_node->is_leaf) new_node->entries.back().child->parent = new_node.get();

    std::vector<bool> used(all_entries.size(), false);
    used[seed1] = true;
    used[seed2] = true;

    size_t remaining = all_entries.size() - 2;
    while (remaining > 0) {
        if (node->entries.size() + remaining == m_) {
            for (size_t i = 0; i < all_entries.size(); ++i) {
                if (!used[i]) {
                    node->entries.push_back(std::move(all_entries[i]));
                    if (!node->is_leaf) node->entries.back().child->parent = node;
                    used[i] = true;
                }
            }
            break;
        }
        if (new_node->entries.size() + remaining == m_) {
            for (size_t i = 0; i < all_entries.size(); ++i) {
                if (!used[i]) {
                    new_node->entries.push_back(std::move(all_entries[i]));
                    if (!new_node->is_leaf) new_node->entries.back().child->parent = new_node.get();
                    used[i] = true;
                }
            }
            break;
        }

        BoundingBox mbr1 = node->compute_mbr();
        BoundingBox mbr2 = new_node->compute_mbr();

        double max_diff = -1.0;
        size_t next_idx = 0;
        double best_enl1 = 0, best_enl2 = 0;

        for (size_t i = 0; i < all_entries.size(); ++i) {
            if (used[i]) continue;

            double enl1 = enlargement(mbr1, all_entries[i].mbr);
            double enl2 = enlargement(mbr2, all_entries[i].mbr);
            double diff = std::abs(enl1 - enl2);

            if (max_diff < 0 || diff > max_diff) {
                max_diff = diff;
                next_idx = i;
                best_enl1 = enl1;
                best_enl2 = enl2;
            }
        }

        bool assign_to_group1 = false;
        if (best_enl1 < best_enl2) {
            assign_to_group1 = true;
        } else if (best_enl1 > best_enl2) {
            assign_to_group1 = false;
        } else {
            double area1 = area(mbr1);
            double area2 = area(mbr2);
            if (area1 < area2) {
                assign_to_group1 = true;
            } else if (area1 > area2) {
                assign_to_group1 = false;
            } else {
                if (node->entries.size() < new_node->entries.size()) {
                    assign_to_group1 = true;
                } else if (node->entries.size() > new_node->entries.size()) {
                    assign_to_group1 = false;
                } else {
                    assign_to_group1 = true;
                }
            }
        }

        if (assign_to_group1) {
            node->entries.push_back(std::move(all_entries[next_idx]));
            if (!node->is_leaf) node->entries.back().child->parent = node;
        } else {
            new_node->entries.push_back(std::move(all_entries[next_idx]));
            if (!new_node->is_leaf) new_node->entries.back().child->parent = new_node.get();
        }

        used[next_idx] = true;
        remaining--;
    }

    return new_node;
}

void RTree::adjust_tree(RTreeNode* node, std::unique_ptr<RTreeNode> split_node) {
    RTreeNode* N = node;
    std::unique_ptr<RTreeNode> NN = std::move(split_node);

    while (N != root_.get()) {
        RTreeNode* P = N->parent;
        
        for (auto& entry : P->entries) {
            if (entry.child.get() == N) {
                entry.mbr = N->compute_mbr();
                break;
            }
        }

        if (NN) {
            BoundingBox nn_mbr = NN->compute_mbr();
            RTreeEntry new_entry(nn_mbr, std::move(NN));
            if (P->entries.size() < M_) {
                P->entries.push_back(std::move(new_entry));
                NN = nullptr;
            } else {
                NN = this->split_node(P, std::move(new_entry));
            }
        }

        N = P;
    }

    if (NN) {
        auto new_root = make_node(false, nullptr);
        
        BoundingBox mbr1 = root_->compute_mbr();
        BoundingBox mbr2 = NN->compute_mbr();
        
        RTreeEntry entry1(mbr1, std::move(root_));
        RTreeEntry entry2(mbr2, std::move(NN));
        
        new_root->entries.push_back(std::move(entry1));
        new_root->entries.push_back(std::move(entry2));
        
        new_root->entries[0].child->parent = new_root.get();
        new_root->entries[1].child->parent = new_root.get();
        
        root_ = std::move(new_root);
    }
}

std::size_t RTree::size() const {
    if (!root_) return 0;
    
    std::size_t count = 0;
    std::vector<const RTreeNode*> stack;
    stack.push_back(root_.get());
    
    while (!stack.empty()) {
        const RTreeNode* node = stack.back();
        stack.pop_back();
        
        if (node->is_leaf) {
            count += node->entries.size();
        } else {
            for (const auto& entry : node->entries) {
                if (entry.child) {
                    stack.push_back(entry.child.get());
                }
            }
        }
    }
    return count;
}

std::size_t RTree::height_node(const RTreeNode* node) const {
    if (!node) return 0;
    if (node->is_leaf) return 1;
    if (node->entries.empty()) return 1;
    return 1 + height_node(node->entries[0].child.get());
}

std::size_t RTree::height() const {
    if (!root_) return 0;
    if (root_->is_leaf && root_->entries.empty()) return 0;
    return height_node(root_.get());
}

bool RTree::validate_node(const RTreeNode* node, BoundingBox expected_mbr) const {
    if (!node) return true;

    // Check parent links
    for (const auto& entry : node->entries) {
        if (!node->is_leaf) {
            if (entry.child) {
                if (entry.child->parent != node) {
                    throw std::logic_error("Broken parent link");
                }
            } else {
                throw std::logic_error("Internal node entry with null child");
            }
        }
    }

    // Check occupancy
    if (node != root_.get()) {
        if (node->entries.size() < m_) {
            throw std::logic_error("Node underflow");
        }
        if (node->entries.size() > M_) {
            throw std::logic_error("Node overflow");
        }
    } else {
        if (!node->is_leaf && node->entries.size() < 2 && !node->entries.empty()) {
            throw std::logic_error("Root underflow");
        }
        if (node->entries.size() > M_) {
            throw std::logic_error("Root overflow");
        }
    }

    // Check MBRs
    if (!node->entries.empty()) {
        BoundingBox actual_mbr = node->compute_mbr();
        if (actual_mbr.min_x != expected_mbr.min_x ||
            actual_mbr.min_y != expected_mbr.min_y ||
            actual_mbr.max_x != expected_mbr.max_x ||
            actual_mbr.max_y != expected_mbr.max_y) {
            throw std::logic_error("Node MBR does not match expected MBR");
        }
        
        for (const auto& entry : node->entries) {
            if (!contains(expected_mbr, entry.mbr)) {
                throw std::logic_error("Entry outside parent MBR");
            }
        }
    }

    // Recursively validate children
    if (!node->is_leaf) {
        for (const auto& entry : node->entries) {
            validate_node(entry.child.get(), entry.mbr);
        }
    }

    return true;
}

bool RTree::validate_structure() const {
    if (!root_) return true;
    if (root_->entries.empty()) return true;
    
    BoundingBox root_mbr = root_->compute_mbr();
    return validate_node(root_.get(), root_mbr);
}

} // namespace kestrel
