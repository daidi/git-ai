package com.daidi.gitai.settings

import java.util.concurrent.atomic.AtomicReference
import javax.swing.SwingUtilities
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class GitAiSettingsComponentTest {
    @Test
    fun `settings component can be created on the event dispatch thread`() {
        val created = AtomicReference<GitAiSettingsComponent>()

        SwingUtilities.invokeAndWait {
            created.set(GitAiSettingsComponent(System.getProperty("java.io.tmpdir")))
        }

        val component = assertNotNull(created.get())
        assertTrue(component.mainPanel.componentCount > 0)
    }
}
