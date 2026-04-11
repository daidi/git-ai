# Language Support and Code Analysis

Use this reference when the user is implementing a custom language plugin or language-aware features such as highlighting, completion, inspections, intentions, quick fixes, documentation, formatting, folding, or structure view.

## What this file covers

- language and file type definitions
- lexer/parser setup
- syntax highlighting
- completion
- annotators
- inspections
- intentions and quick fixes
- surrounding language-support ecosystem

## Custom language support stack

A serious language plugin often includes most of the following:

1. `Language`
2. `LanguageFileType`
3. lexer
4. parser / `ParserDefinition`
5. PSI model
6. syntax highlighter
7. completion contributor
8. references / contributor
9. annotator or inspections
10. formatter
11. folding builder
12. structure view
13. documentation provider
14. find usages provider
15. rename support

## Language and file type

```java
public class SimpleLanguage extends Language {
    public static final SimpleLanguage INSTANCE = new SimpleLanguage();

    private SimpleLanguage() {
        super("Simple");
    }
}
```

```java
public final class SimpleFileType extends LanguageFileType {
    public static final SimpleFileType INSTANCE = new SimpleFileType();

    private SimpleFileType() {
        super(SimpleLanguage.INSTANCE);
    }

    @Override
    public @NotNull String getName() {
        return "Simple File";
    }

    @Override
    public @NotNull String getDescription() {
        return "Simple language file";
    }

    @Override
    public @NotNull String getDefaultExtension() {
        return "simple";
    }

    @Override
    public Icon getIcon() {
        return SimpleIcons.FILE;
    }
}
```

## Parser definition

Use `ParserDefinition` to wire lexer, parser, whitespace/comment/string token sets, and PSI file creation.

## Syntax highlighting

Use `SyntaxHighlighter` when the user needs token-based editor coloring.

Use `Annotator` or inspections when the request involves semantic analysis or error reporting.

## Completion

Use `CompletionContributor` when completions depend on context, PSI position, or surrounding syntax.

Typical pieces:

- `CompletionContributor`
- `CompletionProvider`
- `CompletionParameters`
- `CompletionResultSet`
- `LookupElementBuilder`

### Important: element patterns match LEAF PSI

When using `PlatformPatterns.psiElement()` in `CompletionContributor.extend()`, patterns check against **leaf PSI elements**, not composite nodes. Use `withParent()` or `withSuperParent()` to match enclosing composite elements.

## Annotators vs inspections vs intentions

### Annotator

Use for lightweight, often on-the-fly highlighting and inline diagnostics. Register via `com.intellij.annotator` EP with `language` attribute. Annotators can implement `DumbAware` to run during indexing (since 2023.1).

Since 2024.1, inspections and annotators run **in parallel** rather than sequentially. Ensure highlighting targets the most relevant `PsiElement` to avoid overlapping annotations.

### External annotator

Use `ExternalAnnotator` when validation depends on an external tool (linter, compiler). Runs in a separate phase after other annotators.

### Inspection

Use when the feature should live in the inspections framework, support severity/profile settings, and integrate naturally with code analysis UI.

For plugins with a very large number of inspections, also watch for the `inspection.basicVisitor` optimization path introduced in newer platform versions.

### Intention

Use for explicit editor actions offered to the user when a context applies.

### Quick fix

Use as a remediation attached to an inspection/annotation problem.

## Local inspection pattern

- extend `LocalInspectionTool` or a language-specific inspection base
- implement a PSI visitor
- register problems with `ProblemsHolder`
- attach `LocalQuickFix` when needed

## Intention pattern

- extend `PsiElementBaseIntentionAction`
- implement `isAvailable()` with cheap checks
- implement `invoke()` with safe write logic

## Quick-fix pattern

- implement `LocalQuickFix`
- override `applyFix(Project, ProblemDescriptor)` and `getFamilyName()`
- use `ProblemDescriptor.getPsiElement()` to get the element to fix
- keep fix text user-readable
- perform PSI changes in write command

## Declarative inspection options (since 2023.1)

For inspections that expose configurable options, prefer the declarative API over manual Swing panels:

```java
@Override
public @NotNull OptPane getOptionsPane() {
    return pane(
        checkbox("ignorePrivateMethods", "Ignore private methods"),
        number("maxLineLength", "Maximum line length", 1, 500)
    );
}
```

Use `OptionController` for custom binding logic. Note: if a superclass defines `getOptionsPane()`, any `createOptionsPanel()` in subclasses is silently ignored.

For more advanced cases, return a custom `OptionController` from `getOptionController()` so options can be backed by maps, nested configuration objects, or other non-trivial storage instead of simple fields.

## Parameter info

Use `ParameterInfoHandler` (EP `com.intellij.codeInsight.parameterInfo`) when the user wants signature help while typing function or method arguments. This feature is distinct from completion: it explains the currently selected callable and highlights the active parameter.

## Spell checking

Use `SpellcheckingStrategy` (EP `com.intellij.spellchecker.support`) when identifiers, string literals, comments, or custom PSI tokens should participate in IDE spell checking.

## Safe delete and rename ecosystem

Rename support is only part of the refactoring story. If the language needs structural delete checks, also implement safe-delete support so the IDE can detect references before removing declarations.

### Rename refactoring details

For standard rename support, make sure the PSI and reference layers cooperate correctly:

- `PsiNamedElement.setName()` updates the declaration element
- `PsiReference.handleElementRename()` updates references
- dummy-file or factory-based PSI reconstruction is often the safest way to build replacement nodes
- if references extend `PsiReferenceBase`, `ElementManipulator.handleContentChange()` often becomes the rename path for reference text

Use these extension/customization points when needed:

- `com.intellij.lang.namesValidator` → `NamesValidator` for language-level identifier validation
- `com.intellij.renameInputValidator` → `RenameInputValidator` / `RenameInputValidatorEx` for context-sensitive validation and custom error messages
- `RenamePsiElementProcessor` for renaming alternate elements, linked elements, or customizing conflict/reference handling
- `com.intellij.vetoRenameCondition` to block rename for specific PSI cases
- `RenameHandler` only when you need to replace the standard rename UI/workflow entirely

## Symbols API

For newer platform code, pay attention to the Symbols-based declarations/references model. This is especially relevant when the user asks about cross-language navigation, richer reference semantics, or modern documentation integration.

## Poly Symbols and Web Types

For web-framework and frontend-oriented plugins, also check whether the newer Poly Symbols ecosystem fits better than ad-hoc completion/reference code.

### Poly Symbols

Poly Symbols is the newer framework that supersedes the earlier Web Symbols naming in current SDK docs. It is especially relevant when the task is about HTML/CSS/JS framework metadata, symbol contribution, framework-aware completion, or documentation/navigation for web technologies.

Use Poly Symbols when the plugin needs to:

- contribute statically known framework symbols
- integrate framework metadata with completion, navigation, or documentation
- model web-oriented symbol scopes and contexts instead of hand-writing every contributor

### Web Types

Web Types is a JSON metadata format used to contribute statically defined Poly Symbols. It is a strong fit when the framework surface is mostly declarative.

A plugin can ship Web Types JSON and register it through the `com.intellij.polySymbols.webTypes` extension point. The file can also be discovered from `package.json` in NPM packages or local JS projects.

```xml
<extensions defaultExtensionNs="com.intellij">
    <polySymbols.webTypes
        source="/web-types/my-framework.web-types.json"
        enableByDefault="true"/>
</extensions>
```

Use Web Types when:

- the symbol model is mostly static metadata
- the target domain is web-oriented and already described well by JSON schema
- you want IDE support without building a full custom symbol framework in code

Prefer handwritten Poly Symbols or other language APIs when symbol availability depends heavily on project-specific computation, dynamic resolve, or non-web language structure.

## Navigation bar integration

Use navigation bar support when the language should expose meaningful structural breadcrumbs or file-level navigation in the IDE navbar.

## Documentation provider

### DocumentationTarget API (since 2023.1, recommended)

The modern documentation API uses three extension points:

- `com.intellij.platform.backend.documentation.targetProvider` — for editor offsets
- `com.intellij.platform.backend.documentation.psiTargetProvider` — for PSI elements
- `com.intellij.platform.backend.documentation.symbolTargetProvider` — for Symbols

Implement `DocumentationTarget` to provide rendered HTML documentation. Use `DocumentationMarkup` for consistent formatting and `HtmlSyntaxInfoUtil` for syntax-highlighted code samples.

`DocumentationTarget.createPointer()` must handle invalidated PSI elements gracefully (return null).

### DocumentationProvider (pre-2023.1 / compatibility path)

For new 2023.1+ code, prefer the DocumentationTarget API. Keep `DocumentationProvider` as a legacy compatibility path when supporting older platform lines or existing implementations.

## Inlay hints

Four APIs exist, from newest to oldest. Use the recommended one for each use case.

### Declarative InlayHintsProvider (since 2023.1, recommended for inline)

EP: `com.intellij.codeInsight.declarativeInlayProvider`. UI-independent design for inline textual inlays.

### Code Vision Provider (since 2022.1, recommended for block)

Use `DaemonBoundCodeVisionProvider` (PSI-dependent) or `CodeVisionProvider` (PSI-independent) for above-line code annotations like reference counts, test status, or author information. Treat Code Vision as a specialized, still-evolving UI surface: it is a good fit for block/above-line hints, but not a blanket replacement for every in-editor presentation.

### InlayParameterHintsProvider (simple parameter names)

EP: `com.intellij.codeInsight.parameterNameHints`. For simple string-based parameter name hints at call sites.

### InlayHintsProvider (older API)

`InlayHintsProvider` offers full control, but for new code prefer Declarative Inlay hints for inline text and Code Vision for block/above-line hints unless the older API is still required by the target platform or feature shape.

## Language injection

Three approaches from simplest to most flexible:

1. **IntelliLang XML configuration** — declare injection rules in XML via `org.intellij.intelliLang.injectionConfig` EP. No code needed, but this path depends on the IntelliLang plugin being available.

2. **LanguageInjectionContributor** — EP `com.intellij.languageInjectionContributor`. Implement `LanguageInjectionContributor` and optionally pair with `LanguageInjectionPerformer`. This path is also tied to IntelliLang-based injection infrastructure.

3. **MultiHostInjector** — EP `com.intellij.multiHostInjector`. Most control, supports injecting into multiple fragments within a single host element.

Since 2022.3, `InjectedFormattingOptionsProvider` EP controls formatting behavior inside injected fragments.

## Formatter essentials

### Key classes

- `FormattingModelBuilder` — EP `com.intellij.lang.formatter`
- `Block` — represents a formatting unit with indent, spacing, wrap, and alignment
- `SpacingBuilder` — declarative spacing rules
- `AbstractBlock` — convenience base class

### Critical rules

- The block tree must cover **all non-whitespace characters** in the file
- Spacing elements (whitespace, line breaks) should never be covered by blocks
- The first leaf block does not receive indentation — use `PostFormatProcessor` if needed
- `getChildAttributes()` and `isIncomplete()` control Enter-key indentation behavior

### External formatter (since 2021.3)

Use `AsyncDocumentFormattingService` (EP `com.intellij.formattingService`) for external tools like Prettier, Black, etc.

## Language-support feature map

If the user asks for any of these, you likely need the matching extension point(s):

- syntax coloring → syntax highlighter
- red/yellow diagnostics → annotator / inspection
- auto-complete → completion contributor
- parameter popup while typing → parameter info handler
- Ctrl+B navigation → references / target resolution
- documentation popup → documentation provider
- find usages → find usages provider
- rename support → references + rename handling
- safe delete support → safe delete refactoring hooks
- code folding → folding builder
- structure panel → structure view factory
- navigation bar / breadcrumbs → navbar or breadcrumbs provider
- formatting → formatter / block model
- comment toggling → commenter

## Kotlin-specific notes

- Do not use `object` for extension-point implementations (exception: `FileType` is allowed as `object`)
- Do not use companion objects with `@JvmStatic` in EP implementations in plugins (use top-level or check inspection)
- Prefer classes with lightweight constructors
- Extension implementations must be **stateless** — no initialization in constructors, no static initialization
- An extension registered in plugin.xml must NOT also be registered as a service
- Throw `ExtensionNotApplicableException` in the constructor to opt out of an extension point at runtime
- Prefer coroutine-based read/write APIs on recent platform versions

## Dumb mode note

Some extension points can be `DumbAware`, but only do this if they avoid index-backed work or are documented safe in dumb mode.

## When to also read other references

- Read `extension_points.md` for exact registration syntax
- Read `psi-and-indexing.md` for references, PSI trees, and index-backed resolution
- Read `code_samples.md` for `simple_language_plugin`, inspections, live templates, and intention examples
