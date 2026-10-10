add_executable(test_geometry test_geometry.cpp)
target_link_libraries(test_geometry PRIVATE kestrel_geometry)

add_test(NAME test_geometry COMMAND test_geometry)
