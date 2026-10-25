# KESTREL - CMakeLists.txt
#
# STATUS: Scaffold only. CMake is not currently available on the system PATH.
# This file will be activated at Gate 01 when source files are introduced.
# See PROJECT_SSOT.md section 10 (Toolchain) and OD-001 for the pending
# CMake installation decision.
#
# Required: CMake 3.20+ and a C++17-capable compiler (g++ 16.1.0 available
# via MSYS2 UCRT64 at C:\msys64\ucrt64\bin\).
#
# Intended configure command (MinGW Makefiles):
#   cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Debug
# Intended build command:
#   cmake --build build
# Intended test command:
#   cd build && ctest --output-on-failure

cmake_minimum_required(VERSION 3.20)

project(
    kestrel
    VERSION 0.1.0
    DESCRIPTION "Kepler Belt Mission Backend - Dynamic Spatial Indexing and Hazard Detection"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ----- Compiler warnings (g++ / MinGW) ----------------------------------------
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(
        -Wall
        -Wextra
        -Wpedantic
        -Wshadow
        -Wconversion
    )
endif()

# ----- Source directories ----------------------------------------------------
add_subdirectory(src)

if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/tests/CMakeLists.txt")
    enable_testing()
    add_subdirectory(tests)
endif()

if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/benchmarks/CMakeLists.txt")
    add_subdirectory(benchmarks)
endif()

message(STATUS "KESTREL CMake project configured.")
message(STATUS "Compiler: ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "C++ standard: ${CMAKE_CXX_STANDARD}")
