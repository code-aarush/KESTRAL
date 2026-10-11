add_library(kestrel_geometry STATIC geometry.cpp)
target_include_directories(kestrel_geometry PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

add_library(kestrel_entity STATIC entity.cpp entity_store.cpp simulator.cpp)
target_include_directories(kestrel_entity PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(kestrel_entity PUBLIC kestrel_geometry kestrel_rtree)

add_library(kestrel_rtree STATIC rtree.cpp rtree_node.cpp)
target_include_directories(kestrel_rtree PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(kestrel_rtree PUBLIC kestrel_geometry)

add_library(kestrel_mission STATIC mission.cpp)
target_include_directories(kestrel_mission PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(kestrel_mission PUBLIC kestrel_entity kestrel_rtree kestrel_geometry)

add_executable(kestrel_demo main.cpp)
target_link_libraries(kestrel_demo PRIVATE kestrel_mission kestrel_entity kestrel_rtree kestrel_geometry)

add_executable(kestrel_export export.cpp)
target_link_libraries(kestrel_export PRIVATE kestrel_mission kestrel_entity kestrel_rtree kestrel_geometry)
