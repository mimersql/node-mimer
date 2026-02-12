{
  "targets": [
    {
      "target_name": "mimer",
      "sources": [
        "src/mimer_addon.cc",
        "src/connection.cc",
        "src/statement.cc",
        "src/helpers.cc",
        "src/resultset.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [
        "NAPI_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='linux'", {
          "libraries": [
            "-lmimerapi"
          ],
          "conditions": [
            ["target_arch=='arm64'", {
              "libraries": [
                "-L<!(pwd)/platform_lib/linux-arm64"
              ]
            }]
          ]
        }],
        ["OS=='mac'", {
          "libraries": [
            "-lmimerapi"
          ],
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15"
          }
        }],
        ["OS=='win'", {
          "variables": {
            # Automatically find Mimer SQL installation
            # Searches for latest version in Program Files
            # Falls back to "C:\Program Files\Mimer SQL Experience 11.0" if not found
            "mimer_home": "<!(node scripts/find-mimer-windows.js)"
          },
          "include_dirs": [
            "<(mimer_home)/dev/include"
          ],
          "libraries": [
            "<(mimer_home)/dev/lib/amd64/mimapi64.lib"
          ],
          "defines": ["_HAS_EXCEPTIONS=1"],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    }
  ]
}
