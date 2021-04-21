cmake_minimum_required( VERSION 3.4.1 )

set( LIB_FMOD ${FMOD_API_ROOT}/core/lib/${ANDROID_ABI}/libfmod${FMOD_LIB_SUFFIX}.so )

add_library( fmod SHARED IMPORTED )
    
set_target_properties(
        fmod PROPERTIES
        IMPORTED_LOCATION ${LIB_FMOD}
        INTERFACE_INCLUDE_DIRECTORIES ${FMOD_API_ROOT}/core/inc
        )

add_library(
        example SHARED
        common.cpp
        common_platform.cpp
        3d.cpp
        )

target_link_libraries( example fmod )
