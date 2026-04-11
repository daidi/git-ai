# IntelliJ Platform Code Samples Reference

This document describes the code samples included in the IntelliJ SDK documentation.

## Available Samples

### action_basics
Demonstrates basic action system concepts.

**Key Classes:**
- `PopupDialogAction` - Basic action with dialog
- `CustomDefaultActionGroup` - Action group implementation

**Concepts:**
- Action registration
- Action groups
- Context awareness

### code_inspection_qodana
Custom inspection with Qodana integration. Multi-module Kotlin project demonstrating how to run custom inspections through Qodana CLI.

**Key Classes:**
- `ServicePackageClassNameInspection` - Custom inspection (Kotlin)

### comparing_string_references_inspection
Inspection that detects when String expressions are compared using `==` or `!=` instead of `.equals()`, with a quick fix to convert them.

**Key Classes:**
- `ComparingStringReferencesInspection` - Local inspection tool (extends `AbstractBaseJavaLocalInspectionTool`)

**Concepts:**
- Local inspection
- Quick fixes
- PSI traversal

### conditional_operator_intention
Intention to convert conditional operator to if statement and vice versa.

**Key Classes:**
- `ConditionalOperatorConverter` - Intention action (extends `PsiElementBaseIntentionAction`)

**Concepts:**
- Intention actions
- PSI manipulation

### editor_basics
Editor manipulation basics.

**Key Classes:**
- `EditorIllustrationAction` - Access editor document
- `EditorHandlerIllustration` - Typed handler

**Concepts:**
- Editor access
- Document manipulation
- Caret operations

### facet_basics
Module facet implementation.

**Key Classes:**
- `DemoFacet` - Custom facet
- `DemoFacetConfiguration` - Facet configuration

**Concepts:**
- Module facets
- Facet configuration UI

### framework_basics
Framework support implementation.

**Key Classes:**
- `DemoFramework` - Framework type (extends `FrameworkTypeEx`)

**Concepts:**
- Framework detection
- Framework support in project wizard

### live_templates
Live templates implementation.

**Key Classes:**
- Template definitions
- Template contexts

**Concepts:**
- Live templates
- Template functions

### max_opened_projects
Limits the number of open projects.

**Key Classes:**
- `ProjectCloseListener` - Project lifecycle listener
- `ProjectCountingService` - Tracks open project count

**Concepts:**
- Project lifecycle
- Application state

### module
Custom module type.

**Key Classes:**
- `DemoModuleType` - Module type
- `DemoModuleBuilder` - Module builder

**Concepts:**
- Module types
- Module builders

### project_model
Project model manipulation.

**Key Classes:**
- Project structure modification

**Concepts:**
- Project model
- Module management

### project_view_pane
Custom project view pane.

**Key Classes:**
- `ImagesProjectViewPane` - Project view pane

**Concepts:**
- Project view customization
- Tree structure

### project_wizard
Custom project wizard steps.

**Key Classes:**
- `DemoModuleWizardStep` - Module wizard step

**Concepts:**
- Project wizard
- Wizard steps

### psi_demo
PSI manipulation demonstrations.

**Key Classes:**
- PSI navigation
- PSI modification

**Concepts:**
- PSI tree
- PSI elements

### run_configuration
Custom run configuration.

**Key Classes:**
- `DemoRunConfigurationType` - Configuration type
- `DemoRunConfiguration` - Run configuration
- `DemoConfigurationFactory` - Configuration factory
- `DemoSettingsEditor` - Settings editor

**Concepts:**
- Run configurations
- Configuration factory
- Settings editor

### settings
Settings implementation example.

**Key Classes:**
- `AppSettings` - Persistent state component
- `AppSettingsComponent` - Settings UI
- `AppSettingsConfigurable` - Settings configurable

**Concepts:**
- Persistent state
- Settings UI
- Application configurable

### simple_language_plugin
Complete custom language support.

**Key Classes:**
- `SimpleLanguage` - Language definition
- `SimpleFileType` - File type
- `SimpleParserDefinition` - Parser definition
- `SimpleSyntaxHighlighter` - Syntax highlighter
- `SimpleAnnotator` - Annotator
- `SimpleCompletionContributor` - Completion
- `SimpleReferenceContributor` - References

**Concepts:**
- Language definition
- Lexer and parser
- Syntax highlighting
- Code completion
- References
- Intentions
- Find usages
- Rename refactoring
- Structure view
- Formatter
- Folding

### theme_basics
UI theme customization.

**Key Classes:**
- Theme JSON file

**Concepts:**
- UI themes
- Color schemes
- Custom icons

### tool_window
Tool window implementation.

**Key Classes:**
- `CalendarToolWindowFactory` - Tool window factory

**Concepts:**
- Tool windows
- Content management

### tree_structure_provider
Custom tree structure provider.

**Key Classes:**
- `TextOnlyTreeStructureProvider` - Tree structure provider

**Concepts:**
- Project view tree
- Node decorators

## Priority sample choices by task

Use the sample list selectively instead of reading everything.

### For inspection options and inspection workflows

Prefer these samples first:

- `comparing_string_references_inspection` — best starting point for local inspections, quick fixes, and PSI-based inspection flow
- `code_inspection_qodana` — useful when the task involves inspection packaging, Kotlin-based inspection projects, or Qodana-oriented execution
- `simple_language_plugin` — useful when inspections live inside a broader custom-language implementation

### For rename refactoring and language-aware references

Prefer these samples first:

- `simple_language_plugin` — best starting point for references, find usages, and rename behavior in a custom language plugin
- `psi_demo` — useful when rename support depends on PSI construction or modification patterns rather than a full language stack

### For new project wizard and project creation flows

Prefer these samples first:

- `project_wizard` — first place to look for wizard steps and project/module creation flow structure
- `framework_basics` — useful when the wizard is tied to framework support or framework-oriented setup
- `module` — only when the task is really about legacy module-type or module-builder flows rather than the modern New Project Wizard APIs

### For tool windows and adjacent UI surfaces

Prefer these samples first:

- `tool_window` — primary sample for tool window content and factory structure
- `settings` — useful when the feature spans tool window plus persisted settings/configurable UI
- `project_view_pane` or `tree_structure_provider` — useful for project-view-side integrations rather than tool windows

### For MCP-related work

There is no dedicated official MCP sample in the current SDK sample set.

Prefer these as pattern sources instead:

- `action_basics` — for command/action entry patterns
- `tool_window` — for user-facing surfaces around MCP-backed features
- `settings` — for MCP-related configuration UI and persisted settings
- `project_model` or `psi_demo` — when MCP tools operate on project structure or PSI-backed code actions

For MCP itself, treat `mcp-and-ai-integration.md` and `extension_points.md` as the authoritative starting point, then inspect platform sources if contract details are missing.

### For cross-cutting language-support work

If the user asks for a bundle of language features rather than one isolated API, start with:

- `simple_language_plugin` — best broad sample for parser/highlighting/completion/references/rename/formatter/folding
- `conditional_operator_intention` — focused intention pattern
- `comparing_string_references_inspection` — focused inspection pattern
- `live_templates` — if template authoring is part of the request

### Sample selection heuristics

- prefer the narrowest sample that demonstrates the target feature directly
- use `simple_language_plugin` when the user needs an end-to-end language example rather than an isolated API
- prefer `project_wizard` over `module` for modern project-creation tasks
- prefer `settings` plus `tool_window` together when the feature has both UI and persisted configuration
- for topics without an official sample (such as MCP), use the closest platform-pattern sample and then verify the real API from source or official EP lists

## Sample Structure

Each sample follows this structure:

```
code_samples/<sample_name>/
├── build.gradle.kts
├── gradle/
├── gradle.properties
├── gradlew
├── gradlew.bat
├── settings.gradle.kts
└── src/
    ├── main/
    │   ├── java/
    │   │   └── org/intellij/sdk/<sample>/
    │   │       └── *.java
    │   └── resources/
    │       ├── META-INF/
    │       │   └── plugin.xml
    │       ├── fileTemplates/
    │       ├── icons/
    │       └── liveTemplates/
    └── test/
        ├── java/
        │   └── org/intellij/sdk/<sample>/
        │       └── *Test.java
        └── testData/
            └── *
```

## Running Samples

1. Clone the intellij-sdk-docs repository
2. Open the sample directory in IntelliJ IDEA
3. Import as Gradle project
4. Run the `runIde` Gradle task

```bash
cd code_samples/simple_language_plugin
./gradlew runIde
```
