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
target_link_libraries(test_rtree_trace PRIVATE kestrel_mission kestrel_entity kestrel_rtree kestrel_geometry)

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

add_executable(test_export test_export.cpp ${CMAKE_CURRENT_SOURCE_DIR}/../src/export.cpp)
target_compile_definitions(test_export PRIVATE KESTREL_NO_MAIN)
target_include_directories(test_export PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../src)
target_link_libraries(test_export PRIVATE kestrel_scene kestrel_mission kestrel_entity kestrel_rtree kestrel_geometry)
add_test(NAME test_export COMMAND test_export)

add_executable(test_export_trace test_export_trace.cpp ${CMAKE_CURRENT_SOURCE_DIR}/../src/export.cpp)
target_compile_definitions(test_export_trace PRIVATE KESTREL_NO_MAIN)
target_include_directories(test_export_trace PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../src)
target_link_libraries(test_export_trace PRIVATE kestrel_scene kestrel_mission kestrel_entity kestrel_rtree kestrel_geometry)
add_test(NAME test_export_trace COMMAND test_export_trace)

add_executable(test_query_service test_query_service.cpp ${CMAKE_CURRENT_SOURCE_DIR}/../src/query_service.cpp)
target_compile_definitions(test_query_service PRIVATE KESTREL_NO_MAIN)
target_include_directories(test_query_service PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../src)
target_link_libraries(test_query_service PRIVATE kestrel_scene kestrel_mission kestrel_entity kestrel_rtree kestrel_geometry)
add_test(NAME test_query_service COMMAND test_query_service)
