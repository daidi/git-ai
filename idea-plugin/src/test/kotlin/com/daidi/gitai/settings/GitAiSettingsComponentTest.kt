package com.daidi.gitai.settings

import java.util.concurrent.atomic.AtomicReference
import javax.swing.SwingUtilities
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class GitAiSettingsComponentTest {
    @Test
    fun `attribution supports global opt-in and project inheritance or opt-out`() {
        SwingUtilities.invokeAndWait {
            val component = GitAiSettingsComponent(System.getProperty("java.io.tmpdir"))
            val global = GitAiConfigManager.DEFAULTS.copy(commitAttribution = "compact")
            component.setGlobalConfig(global)
            assertEquals("compact", component.getGlobalConfig().commitAttribution)
            component.setProjectConfig(GitAiConfig(), global)
            assertNull(component.getProjectConfig().commitAttribution)
            component.setProjectConfig(GitAiConfig(commitAttribution = "off"), global)
            assertEquals("off", component.getProjectConfig().commitAttribution)
            component.setProjectConfig(GitAiConfig(commitAttribution = "compact"), global)
            assertEquals("compact", component.getProjectConfig().commitAttribution)
        }
    }

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
