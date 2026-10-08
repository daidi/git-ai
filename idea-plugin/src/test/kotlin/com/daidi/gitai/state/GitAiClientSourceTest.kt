package com.daidi.gitai.state

import kotlin.test.Test
import kotlin.test.assertEquals

class GitAiClientSourceTest {
    @Test
    fun `product editions share a label and unknown products stay generic`() {
        for ((code, source) in mapOf(
            "IC" to "intellij", "IU" to "intellij", "PC" to "pycharm", "PY" to "pycharm",
            "WS" to "webstorm", "GO" to "goland", "PS" to "phpstorm", "RD" to "rider",
            "CL" to "clion", "DB" to "datagrip", "RM" to "rubymine", "AI" to "android-studio",
            "unrecognized-private-string" to "jetbrains",
        )) {
            assertEquals(source, GitAiClientSource.fromProductCode(code))
        }
    }
}
