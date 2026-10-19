add_executable(test_geometry test_geometry.cpp)
target_link_libraries(test_geometry PRIVATE kestrel_geometry)

add_test(NAME test_geometry COMMAND test_geometry)

add_executable(test_entity test_entity.cpp)
target_link_libraries(test_entity PRIVATE kestrel_entity kestrel_geometry)

add_test(NAME test_entity COMMAND test_entity)

add_executable(test_rtree test_rtree.cpp)
target_link_libraries(test_rtree PRIVATE kestrel_rtree kestrel_geometry)

add_test(NAME test_rtree COMMAND test_rtree)

add_executable(test_rtree_insert test_rtree_insert.cpp)
target_link_libraries(test_rtree_insert PRIVATE kestrel_rtree kestrel_geometry)

add_test(NAME test_rtree_insert COMMAND test_rtree_insert)

add_executable(test_rtree_query test_rtree_query.cpp)
target_link_libraries(test_rtree_query PRIVATE kestrel_rtree kestrel_geometry)

add_test(NAME test_rtree_query COMMAND test_rtree_query)

add_executable(test_rtree_trace test_rtree_trace.cpp)
target_link_libraries(test_rtree_trace PRIVATE kestrel_rtree kestrel_geometry)

add_test(NAME test_rtree_trace COMMAND test_rtree_trace)

add_executable(test_rtree_delete test_rtree_delete.cpp)
target_link_libraries(test_rtree_delete PRIVATE kestrel_rtree kestrel_geometry)

add_test(NAME test_rtree_delete COMMAND test_rtree_delete)

add_executable(test_simulator test_simulator.cpp)
target_link_libraries(test_simulator PRIVATE kestrel_entity kestrel_rtree kestrel_geometry)

add_test(NAME test_simulator COMMAND test_simulator)

add_executable(test_mission test_mission.cpp)
target_link_libraries(test_mission PRIVATE kestrel_mission kestrel_entity kestrel_rtree kestrel_geometry)

add_test(NAME test_mission COMMAND test_mission)

add_executable(test_stress test_stress.cpp)
target_link_libraries(test_stress PRIVATE kestrel_mission kestrel_entity kestrel_rtree kestrel_geometry)
add_test(NAME test_stress COMMAND test_stress)
