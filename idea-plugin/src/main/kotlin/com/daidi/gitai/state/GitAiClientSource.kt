package com.daidi.gitai.state

/** Only stable product labels leave the IDE; no installation path or build ID. */
internal object GitAiClientSource {
    fun fromProductCode(code: String): String = when (code) {
        "IU", "IC" -> "intellij"
        "PY", "PC", "PE" -> "pycharm"
        "WS" -> "webstorm"
        "GO" -> "goland"
        "PS" -> "phpstorm"
        "RD" -> "rider"
        "CL" -> "clion"
        "DB" -> "datagrip"
        "RM" -> "rubymine"
        "AI" -> "android-studio"
        else -> "jetbrains"
    }
}
