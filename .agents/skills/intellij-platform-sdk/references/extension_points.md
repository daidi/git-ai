# IntelliJ Platform Extension Points Reference

Common extension points for IntelliJ Platform plugins.

## Declaring your own extension points

Use a top-level `<extensionPoints>` block when the plugin exposes extensibility to other plugins.

```xml
<extensionPoints>
    <extensionPoint
        name="myCustomEp"
        interface="com.example.api.MyExtension"
        dynamic="true"/>
</extensionPoints>
```

Guidance:
- use `interface` for behavioral contracts and `beanClass` for XML-configured beans
- prefer `dynamic="true"` when unload safety is realistic
- access the EP in code via `ExtensionPointName.create("com.example.myCustomEp")`
- keep extension implementations stateless and lightweight; throw `ExtensionNotApplicableException` in constructors when conditional registration is needed
- `defaultExtensionNs="com.intellij"` is for platform EPs; use your own plugin ID namespace for custom EPs

## Actions

Actions are registered under a top-level `<actions>` block in `plugin.xml`, not inside `<extensions>`.

```xml
<actions>
    <!-- Action -->
    <action id="unique.id"
            class="com.example.MyAction"
            text="Action Text"
            description="Action description"
            icon="/icons/action.svg">
        <add-to-group group-id="ToolsMenu" anchor="last"/>
        <keyboard-shortcut keymap="$default" first-keystroke="ctrl alt T"/>
    </action>

    <!-- Action Group -->
    <group id="my.group"
           text="Group Text"
           popup="true"
           icon="/icons/group.svg">
        <add-to-group group-id="MainMenu" anchor="after" relative-to-action="ToolsMenu"/>
    </group>
</actions>
```

## Services

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Application service -->
    <applicationService
        serviceInterface="com.example.MyService"
        serviceImplementation="com.example.MyServiceImpl"/>

    <!-- Project service -->
    <projectService
        serviceInterface="com.example.MyProjectService"
        serviceImplementation="com.example.MyProjectServiceImpl"/>

    <!-- Module service (not recommended — increases memory) -->
    <moduleService
        serviceImplementation="com.example.MyModuleService"/>
</extensions>
```

## Editor

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Completion -->
    <completion.contributor
        language="JAVA"
        implementationClass="com.example.MyCompletionContributor"/>

    <!-- Annotator -->
    <annotator
        language="JAVA"
        implementationClass="com.example.MyAnnotator"/>

    <!-- Line marker -->
    <codeInsight.lineMarkerProvider
        language="JAVA"
        implementationClass="com.example.MyLineMarkerProvider"/>

    <!-- Enter handler -->
    <enterHandlerDelegate
        implementation="com.example.MyEnterHandler"/>

    <!-- Typed handler -->
    <typedHandler
        implementation="com.example.MyTypedHandler"/>
</extensions>
```

## Code Analysis

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Local inspection -->
    <localInspection
        language="JAVA"
        displayName="My Inspection"
        groupPath="Java"
        groupName="Probable bugs"
        enabledByDefault="true"
        level="WARNING"
        implementationClass="com.example.MyInspection"/>

    <!-- Global inspection -->
    <globalInspection
        displayName="My Global Inspection"
        groupName="General"
        implementationClass="com.example.MyGlobalInspection"/>

    <!-- Intention -->
    <intentionAction>
        <className>com.example.MyIntention</className>
        <category>Java/Refactoring</category>
    </intentionAction>

    <!-- Quick fix -->
    <!-- Registered via inspection or intention -->
</extensions>
```

## Language Support

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Language -->
    <lang.parserDefinition
        language="Simple"
        implementationClass="com.example.SimpleParserDefinition"/>

    <!-- Syntax highlighter factory -->
    <lang.syntaxHighlighterFactory
        language="Simple"
        implementationClass="com.example.SimpleSyntaxHighlighterFactory"/>

    <!-- Commenter -->
    <lang.commenter
        language="Simple"
        implementationClass="com.example.SimpleCommenter"/>

    <!-- Brace matcher -->
    <lang.braceMatcher
        language="Simple"
        implementationClass="com.example.SimpleBraceMatcher"/>

    <!-- Quote handler -->
    <lang.quoteHandler
        language="Simple"
        implementationClass="com.example.SimpleQuoteHandler"/>

    <!-- Folding -->
    <lang.foldingBuilder
        language="Simple"
        implementationClass="com.example.SimpleFoldingBuilder"/>

    <!-- Structure view -->
    <lang.psiStructureViewFactory
        language="Simple"
        implementationClass="com.example.SimpleStructureViewFactory"/>

    <!-- Documentation (legacy compatibility path; for new 2023.1+ code prefer DocumentationTarget EPs) -->
    <!-- <lang.documentationProvider
        language="Simple"
        implementationClass="com.example.SimpleDocumentationProvider"/> -->

    <!-- Documentation Target API (since 2023.1, recommended) -->
    <platform.backend.documentation.targetProvider
        implementation="com.example.SimpleDocTargetProvider"/>
    <!-- or for PSI-based: -->
    <platform.backend.documentation.psiTargetProvider
        implementation="com.example.SimplePsiDocTargetProvider"/>
    <!-- or for symbol-based: -->
    <platform.backend.documentation.symbolTargetProvider
        implementation="com.example.SimpleSymbolDocTargetProvider"/>

    <!-- Find usages -->
    <lang.findUsagesProvider
        language="Simple"
        implementationClass="com.example.SimpleFindUsagesProvider"/>

    <!-- Custom rename flow only; default PSI/reference-based rename usually does not need this EP -->
    <renameHandler
        implementationClass="com.example.SimpleRenameHandler"/>

    <!-- Formatter -->
    <lang.formatter
        language="Simple"
        implementationClass="com.example.SimpleFormattingModelBuilder"/>

    <!-- External formatter (since 2021.3) -->
    <formattingService
        implementation="com.example.MyExternalFormattingService"/>

    <!-- Spell checking -->
    <spellchecker.support
        language="Simple"
        implementationClass="com.example.SimpleSpellcheckingStrategy"/>

    <!-- Parameter info -->
    <codeInsight.parameterInfo
        language="Simple"
        implementationClass="com.example.SimpleParameterInfoHandler"/>

    <!-- Breadcrumbs / Sticky Lines -->
    <breadcrumbsInfoProvider
        implementation="com.example.SimpleBreadcrumbsProvider"/>

    <!-- Smart Enter -->
    <lang.smartEnterProcessor
        language="Simple"
        implementationClass="com.example.SimpleSmartEnterProcessor"/>

    <!-- Color preview in gutter -->
    <colorProvider
        implementation="com.example.SimpleColorProvider"/>

    <!-- Surround With -->
    <lang.surroundDescriptor
        language="Simple"
        implementationClass="com.example.SimpleSurroundDescriptor"/>
</extensions>
```

## Inlay Hints and Code Vision

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Declarative inlay hints (since 2023.1, recommended for inline) -->
    <codeInsight.declarativeInlayProvider
        language="Simple"
        implementationClass="com.example.SimpleDeclarativeInlayProvider"
        group="VALUES_GROUP"
        isEnabledByDefault="true"
        providerId="com.example.simple.inlay"/>

    <!-- Declarative inlay custom settings -->
    <codeInsight.declarativeInlayProviderCustomSettingsProvider
        implementation="com.example.SimpleDeclarativeInlaySettingsProvider"/>

    <!-- Parameter name hints (simple string-based) -->
    <codeInsight.parameterNameHints
        language="Simple"
        implementationClass="com.example.SimpleParameterNameHintsProvider"/>

    <!-- Optional parameter-name-hint suppression -->
    <codeInsight.parameterNameHintsSuppressor
        implementation="com.example.SimpleParameterHintsSuppressor"/>

    <!-- Code Vision (since 2022.1, recommended for block/above-line) -->
    <codeInsight.daemonBoundCodeVisionProvider
        implementation="com.example.SimpleCodeVisionProvider"/>

    <!-- Code Vision settings entry -->
    <config.codeVisionGroupSettingProvider
        implementation="com.example.SimpleCodeVisionGroupSettingProvider"/>
</extensions>
```

## Language Injection

```xml
<extensions defaultExtensionNs="com.intellij">
    <languageInjectionContributor
        implementation="com.example.SimpleLanguageInjectionContributor"
        language="Simple"/>

    <languageInjectionPerformer
        implementation="com.example.SimpleLanguageInjectionPerformer"/>

    <multiHostInjector
        implementation="com.example.SimpleMultiHostInjector"/>
</extensions>
```

## LSP

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- LSP server support is only available for supported IntelliJ Platform versions / IDE products; see lsp.md for product and 2025.2.1 dependency boundaries -->
    <platform.lsp.serverSupportProvider
        implementation="com.example.MyLspServerSupportProvider"/>
</extensions>
```

## MCP

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- MCP support is product- and build-specific; verify the target IDE actually exposes these EPs -->
    <mcpServer.mcpToolsProvider
        implementation="com.example.MyMcpToolsProvider"/>

    <mcpServer.mcpToolset
        implementation="com.example.MyMcpToolset"/>
</extensions>
```

Guidance:
- Use these EPs only after confirming the target IDE/product line actually exposes the MCP surface you need.
- Keep implementations stateless and lightweight; put real tool logic in services.
- Treat MCP registration as version-scoped rather than universally available.
- Read `mcp-and-ai-integration.md` for scope and contract-boundary guidance.

## UI Components

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Tool window -->
    <toolWindow
        id="My Tool Window"
        anchor="right"
        secondary="true"
        icon="/icons/toolwindow.svg"
        factoryClass="com.example.MyToolWindowFactory"/>

    <!-- Settings page -->
    <applicationConfigurable
        parentId="tools"
        instance="com.example.MyAppSettings"
        id="com.example.MyAppSettings"
        displayName="My Settings"/>

    <projectConfigurable
        parentId="tools"
        instance="com.example.MyProjectSettings"
        id="com.example.MyProjectSettings"
        displayName="My Project Settings"/>

    <!-- Notification group -->
    <notificationGroup
        id="MyPlugin.Notification"
        displayType="BALLOON"/>

    <!-- Status bar widget -->
    <statusBarWidgetFactory
        id="com.example.MyWidget"
        implementation="com.example.MyWidgetFactory"/>

    <!-- Editor notification banner -->
    <editorNotificationProvider
        implementation="com.example.MyEditorNotificationProvider"/>
</extensions>
```

## Project Model

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Project wizard (obsolete — consider newer wizard API) -->
    <moduleType
        id="MY_MODULE"
        implementationClass="com.example.MyModuleType"/>

    <!-- Project view decorator -->
    <treeStructureProvider
        implementation="com.example.MyTreeStructureProvider"/>

    <!-- File icon provider -->
    <iconProvider
        implementation="com.example.MyIconProvider"/>

    <!-- File editor provider -->
    <fileEditorProvider
        implementationClass="com.example.MyEditorProvider"/>
</extensions>
```

## Run/Debug

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Run configuration type -->
    <configurationType
        implementation="com.example.MyConfigurationType"/>

    <!-- Run configuration producer -->
    <runConfigurationProducer
        implementation="com.example.MyConfigurationProducer"/>

    <!-- Program runner -->
    <programRunner
        implementation="com.example.MyProgramRunner"/>

    <!-- Execution console -->
    <consoleFilterProvider
        implementation="com.example.MyConsoleFilterProvider"/>
</extensions>
```

## Indexing

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- File-based index -->
    <fileBasedIndex
        implementation="com.example.MyFileIndex"/>

    <!-- Stub index -->
    <stubIndex
        implementation="com.example.MyStubIndex"/>

    <!-- Stub element type holder -->
    <stubElementTypeHolder
        class="com.example.SimpleTypes"/>
</extensions>
```

## File Types

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- File type -->
    <fileType
        name="Simple File"
        implementationClass="com.example.SimpleFileType"
        fieldName="INSTANCE"
        language="Simple"
        extensions="simple"/>

    <!-- File type factory (deprecated since 2019.2, use fileType instead) -->
    <!-- <fileTypeFactory implementation="com.example.SimpleFileTypeFactory"/> -->
</extensions>
```

## VCS Integration

```xml
<extensions defaultExtensionNs="com.intellij">
    <!-- Change list decorator -->
    <vcs.changeListDecorator
        implementation="com.example.MyChangeListDecorator"/>

    <!-- Checkin handler factory -->
    <checkinHandlerFactory
        implementation="com.example.MyCheckinHandlerFactory"/>
</extensions>
```

## Common Action Group IDs

| Group ID | Location |
|----------|----------|
| `MainMenu` | Main menu bar |
| `ToolsMenu` | Tools menu |
| `EditMenu` | Edit menu |
| `ViewMenu` | View menu |
| `CodeMenu` | Code menu |
| `RefactoringMenu` | Refactor menu |
| `BuildMenu` | Build menu |
| `RunMenu` | Run menu |
| `WindowMenu` | Window menu |
| `HelpMenu` | Help menu |
| `ProjectViewPopupMenu` | Project view right-click |
| `EditorPopupMenu` | Editor right-click |
| `EditorGutterPopupMenu` | Editor gutter right-click |
| `NavbarPopupMenu` | Navigation bar right-click |
| `MainToolbar` | Main toolbar |
| `NavBarToolbar` | Navigation bar toolbar |
| `GenerateGroup` | Generate menu (Alt+Insert) |
| `NewGroup` | New menu |
