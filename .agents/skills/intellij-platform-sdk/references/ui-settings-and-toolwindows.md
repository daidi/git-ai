# UI, Settings, Tool Windows, and Project Integration

Use this reference when the user needs dialogs, tool windows, settings pages, notifications, project wizard integration, or project-view customization.

## What this file covers

- dialogs and IntelliJ UI components
- Kotlin UI DSL v2
- tool windows
- settings/configurables
- persistent state
- notifications
- popups (JBPopup, ListPopup)
- project wizard and project-view integration
- status bar widgets and editor notifications

## UI principles

Prefer IntelliJ UI components and platform conventions over raw Swing where possible.

Useful classes include:

- `DialogWrapper`
- `SimpleToolWindowPanel`
- `JBTextField`, `JBCheckBox`, `JBList`, `Tree`
- `JBScrollPane`

### DPI-aware components

Prefer `JBUI.Borders` and `JBUI.Insets` factory methods instead of raw `java.awt` instances when building IntelliJ UI. Prefer `JBColor` instead of `java.awt.Color` for theme-aware colors, and use `JBColor.namedColor()` when the color should adapt to custom themes.

## Kotlin UI DSL v2

The modern way to build settings panels, dialogs, and forms in IntelliJ Platform (since 2021.3). Prefer this over raw Swing layout for new code.

**Important caveat:** The DSL is designed for settings panels, dialogs, and forms with input components bound to state objects. It is NOT intended for general UIs like tool window controls that trigger actions without input binding — use custom Swing components for those.

### Core structure

```kotlin
panel {
    group("General") {
        row("Name:") {
            textField()
                .bindText(settings::name)
                .align(AlignX.FILL)
        }
        row {
            checkBox("Enable feature")
                .bindSelected(settings::enabled)
        }
    }
    collapsibleGroup("Advanced") {
        row("Timeout (ms):") {
            intTextField()
                .bindIntText(settings::timeout)
        }
    }
}
```

### Key building blocks

- `panel { }` — top-level container
- `row("Label:") { }` — a row with optional left-aligned label
- `group("Title") { }` — titled section with its own grid
- `collapsibleGroup("Title") { }` — expandable section
- `buttonsGroup { }` — radio button group
- `indent { }` — indented sub-section
- `separator()` — horizontal divider

### Data binding

```kotlin
row("Text:") {
    textField()
        .bindText(model::textField)
}
row {
    checkBox("Enabled")
        .bindSelected(model::checkbox)
}
row("Color:") {
    comboBox(listOf("Red", "Green", "Blue"))
        .bindItem(model::color)
}
```

### Conditional visibility and enabled state

Use `visibleIf` for conditional visibility and `enabledIf` for conditional enabled state. Both can be applied at `Row` or `Cell` level:

```kotlin
lateinit var enabledCheckbox: Cell<JBCheckBox>

row {
    enabledCheckbox = checkBox("Enable advanced mode")
        .bindSelected(settings::advancedMode)
}
row("Detail:") {
    textField()
        .bindText(settings::detail)
        .enabledIf(enabledCheckbox.selected)  // Cell-level enabledIf
}
// Or at row level:
row("Advanced:") {
    textField()
}.enabledIf(enabledCheckbox.selected)  // Row-level enabledIf
```

### With BoundConfigurable

The simplest way to create a settings page:

```kotlin
class MySettingsConfigurable : BoundConfigurable("My Plugin Settings") {
    override fun createPanel() = panel {
        row("API key:") {
            cell(JPasswordField())
                .bind(
                    { component -> String(component.password) },
                    { component, value -> component.text = value },
                    settings::apiKey.toMutableProperty()
                )
                .align(AlignX.FILL)
        }
    }
}
```

`BoundConfigurable` automatically handles `apply()`, `reset()`, and `isModified()` through bindings.

### Lifecycle callbacks on panel

```kotlin
panel {
    onApply { /* called when user clicks Apply/OK */ }
    onReset { /* called when UI resets to stored values */ }
    onIsModified { /* return true if there are unsaved changes */ }
}
```

## Dialogs

### Quick dialogs

Use `Messages` for simple confirmation/info/input flows.

### Custom dialogs

Use `DialogWrapper` when the dialog has validation, multiple fields, custom buttons, or lifecycle handling.

## Tool windows

### Core classes

- `ToolWindowFactory`
- `ToolWindow`
- `ContentFactory` (use `ContentFactory.getInstance().createContent()` to create content)
- `SimpleToolWindowPanel`
- `ActionToolbar`

### Tool-window pattern

1. Register tool window in `plugin.xml` via `com.intellij.toolWindow` EP
2. Create panel/content in `ToolWindowFactory.createToolWindowContent()`
3. Add toolbar if actions make sense
4. Keep heavy loading deferred when possible

### Important notes

- Tool windows are disabled during indexing unless `ToolWindowFactory` implements `DumbAware`
- Use suspending `ToolWindowFactory.isApplicableAsync(Project)` for conditional display evaluated during project load; it is not the right mechanism for arbitrary runtime show/hide decisions after the project is already open
- For programmatic tool windows (shown after specific actions), use `ToolWindowManager.registerToolWindow()`
- Use `ToolWindowManager.invokeLater()` instead of `Application.invokeLater()` for EDT tasks related to tool windows

## New Project Wizard

For new-project creation flows, prefer the modern New Project Wizard APIs rather than legacy module/project builder patterns when targeting current platform versions.

Use this path when the plugin needs to:

- add a new project generator or framework/module setup step
- collect user input during project creation
- generate starter files, SDK settings, or module structure from wizard data

Key APIs and extension points:

- `LanguageGeneratorNewProjectWizard` + `com.intellij.newProjectWizard.languageGenerator`
- `GeneratorNewProjectWizard` + `com.intellij.newProjectWizard.generator`
- `NewProjectWizardStep` for step implementations
- `RootNewProjectWizardStep` for framework-style root setup
- `NewProjectWizardChainStep` / `nextStep()` for multi-step flows shown on one screen

Guidance:

- use Kotlin UI DSL v2 in `setupUI()`
- keep `setupProject()` focused on applying collected data
- use language generators for general-purpose project types and framework generators for technology-specific flows
- prefer the new wizard APIs over legacy `ModuleBuilder` flows unless compatibility requirements force the older path

Keep wizard steps lightweight, validate inputs early, and separate UI collection from project-generation logic.

## Settings and persistent state

### Persistent state

Use `PersistentStateComponent` with `@State` when the user needs plugin settings saved across restarts.

For Kotlin code, prefer the newer helpers when they fit:
- `SimplePersistentStateComponent`
- `SerializablePersistentStateComponent`
- `BaseState` delegates for mutable state properties

For very small non-roamable values, `PropertiesComponent` can be enough. Use `@Storage` options like `StoragePathMacros.WORKSPACE_FILE` or `StoragePathMacros.CACHE_FILE` when the storage location matters.

### Settings UI

Register settings pages using the appropriate extension point:

- `com.intellij.applicationConfigurable` — application-level settings (no-arg constructor)
- `com.intellij.projectConfigurable` — project-level settings (constructor takes `Project`)

Both require `id`, `displayName` (or `key`+`bundle`), and `parentId` attributes. Common `parentId` values: `tools`, `editor`, `appearance`, `build`, `language`.

### Configurable thread safety

IntelliJ may instantiate `Configurable` on a background thread. Do not create Swing components in the constructor — defer UI creation to `createComponent()`. Constructor rules:

- Application-level settings: **no-arg constructor** only
- Project-level settings: single `Project` argument only
- No other dependency injection in constructors

### Typical split

- settings state class/service
- UI component/panel (prefer Kotlin UI DSL v2)
- configurable wrapper implementing `Configurable`

## Notifications

Use the platform notification system instead of custom popups for normal plugin feedback.

### Setup

1. Declare a notification group in `plugin.xml`:

```xml
<notificationGroup id="MyPlugin.Notifications" displayType="BALLOON"/>
```

For `TOOL_WINDOW` notifications, also provide the related `toolWindowId`.

Display types: `BALLOON` (timed), `STICKY_BALLOON` (sticky suggestion), `TOOL_WINDOW` (in tool window), `NONE`.

2. Create and show notifications:

```java
new Notification("MyPlugin.Notifications", "Task completed", NotificationType.INFORMATION)
    .addAction(NotificationAction.createSimpleExpiring("View", () -> showResults()))
    .notify(project);
```

### Typical uses

- success/failure summaries (`BALLOON`)
- background-task completion (`BALLOON`)
- actionable warnings with follow-up buttons (`STICKY_BALLOON`)
- tool window log output (`TOOL_WINDOW`)

## Persisting sensitive data

Use `PasswordSafe` for storing passwords, tokens, and other sensitive data. Do NOT store secrets in `PersistentStateComponent` or properties files.

```java
// Create credential attributes
CredentialAttributes attrs = new CredentialAttributes(
    CredentialAttributesKt.generateServiceName("MyPlugin", key)
);

// Store
PasswordSafe.getInstance().set(attrs, new Credentials(username, password));

// Retrieve
Credentials credentials = PasswordSafe.getInstance().get(attrs);
```

**Important:** `PasswordSafe.get()` is blocking — avoid calling it on EDT. Since 2025.3, use `getAsync()` in coroutines for Remote Development-sensitive flows. Treat credential writes with the same general care for UI responsiveness, but rely on the official API guidance for the exact operation you are calling.

The concrete credential store depends on the operating system and user/environment configuration. Typical defaults are KeePass (Windows), Keychain (macOS), and Secret Service API (Linux), but do not assume the provider is immutable.

## Status bar widgets

EP: `com.intellij.statusBarWidgetFactory` with `StatusBarWidgetFactory` implementation.

```xml
<statusBarWidgetFactory
    id="com.example.MyWidget"
    implementation="com.example.MyWidgetFactory"/>
```

The `id` attribute must match `StatusBarWidgetFactory.getId()`. Widget presentations: `IconPresentation`, `TextPresentation`, `MultipleTextValuesPresentation` (cannot be combined). For custom content, implement `CustomStatusBarWidget` and override `getComponent()`.

For editor/file-sensitive widgets, `StatusBarEditorBasedWidgetFactory` and editor-based widget helpers are often a better fit than a generic factory.

For LightEdit mode support, implement `LightEditCompatible` in the factory.

## Editor notifications and banners

### EditorNotificationProvider

EP: `com.intellij.editorNotificationProvider`. Shows persistent banners at the top of editor tabs. If banner visibility depends on indexes, resolution, or other smart-mode-only data, make the implementation degrade gracefully during dumb mode instead of assuming those services are always available.

```java
class MyNotificationProvider implements EditorNotificationProvider {
    @Override
    public @Nullable Function<FileEditor, JComponent> collectNotificationData(
            @NotNull Project project, @NotNull VirtualFile file) {
        if (!shouldShowBanner(file)) return null;
        return fileEditor -> {
            EditorNotificationPanel panel = new EditorNotificationPanel(fileEditor);
            panel.setText("Configuration needed");
            panel.createActionLabel("Configure", () -> showSettings(project));
            return panel;
        };
    }
}
```

### GotItTooltip

Use `GotItTooltip` to highlight new or changed features to the user. Shows once per feature.

### HintManager

Use `HintManager.showErrorHint()` for lightweight error messages from editor actions. These hints auto-dismiss.

## Embedded editor components

### EditorTextField

Use `EditorTextField` to embed a full editor with syntax highlighting, completion, and folding inside dialogs or tool windows:

```java
EditorTextField editor = new EditorTextField(
    "", project, PlainTextFileType.INSTANCE
);
```

### LanguageTextField

A more accessible API for editor input fields in dialogs. Provides language-specific features.

## Popups (JBPopup)

Use `JBPopupFactory` for lightweight popup menus, choosers, and inline UI.

### Popup types

| Factory method | Use case |
|---------------|----------|
| `createPopupChooserBuilder()` | Select item from a list |
| `createActionGroupPopup()` | Show and execute actions |
| `createComponentPopupBuilder()` | Display any Swing component |
| `createConfirmation()` | Yes/no confirmation |

### List chooser

```java
JBPopupFactory.getInstance()
    .createPopupChooserBuilder(items)
    .setTitle("Choose Item")
    .setItemChosenCallback(item -> {
        // handle selection
    })
    .createPopup()
    .showInBestPositionFor(editor);
```

### Action group popup

```java
JBPopupFactory.getInstance()
    .createActionGroupPopup(
        "Title",
        actionGroup,
        dataContext,
        JBPopupFactory.ActionSelectionAid.SPEEDSEARCH,
        true // show disabled actions
    )
    .showUnderneathOf(component);
```

### ListPopup with steps

For hierarchical or customized list popups:

```java
ListPopupStep<String> step = new BaseListPopupStep<>("Title", items) {
    @Override
    public PopupStep<?> onChosen(String selectedValue, boolean finalChoice) {
        // return FINAL_CHOICE or a new step for sub-menu
        return doFinalStep(() -> handleSelection(selectedValue));
    }
};
JBPopupFactory.getInstance().createListPopup(step).showInBestPositionFor(editor);
```

### Display methods

- `showInBestPositionFor(editor)` — near caret
- `showUnderneathOf(component)` — below a component
- `showInCenterOf(component)` — centered on a component

### Popup lifecycle

`show()` methods return immediately — use `addListener(JBPopupListener)` to detect closing. For step-based popups, override `PopupStep.onChosen()`.

## Project integration

If the user asks for project-level UX changes, consider these hooks:

- project wizard/module wizard integration
- for modern New Project Wizard work, prefer the newer wizard APIs over legacy module-type/module-wizard hooks
- project view panes
- tree structure providers
- custom module types
- framework support providers

## Choosing the right surface

- one-off command entry → action
- persistent side panel → tool window
- plugin preferences → settings page (prefer Kotlin UI DSL v2)
- short status/feedback → notification
- quick item selection / context menu → `JBPopup`
- multi-step structured user input → `DialogWrapper`
- project creation flow → wizard/module/project template APIs

## UX guardrails

- do not interrupt users with unnecessary modal dialogs
- prefer notifications for non-blocking feedback
- keep tool windows useful even when empty
- reflect platform terminology and menu placement
- avoid surprising behavior in core IDE surfaces

## When to also read other references

- Read `platform-basics.md` for actions and threading around UI-triggered work
- Read `extension_points.md` for exact XML declarations
- Read `code_samples.md` for `tool_window`, `settings`, `project_wizard`, and `project_view_pane`
