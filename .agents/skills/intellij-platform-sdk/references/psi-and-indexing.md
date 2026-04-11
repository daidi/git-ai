# PSI and Indexing

Use this reference when the user needs to inspect code structure, resolve symbols, modify source, build references, or create indexes/stubs.

## What this file covers

- PSI navigation
- PSI creation and modification
- references and resolution
- file-based indexes
- stub indexes
- performance rules for PSI/indexing work

## PSI essentials

### Key classes

- `PsiElement`
- `PsiFile`
- `PsiNamedElement`
- `PsiReference`
- `PsiManager`
- `PsiTreeUtil`
- `PsiRecursiveElementWalkingVisitor`

Java PSI classes (require dependency on `com.intellij.modules.java`):

- `JavaPsiFacade`
- `PsiElementFactory`

### Typical PSI workflow

1. Start from `Project`, `Editor`, `VirtualFile`, or caret offset
2. Resolve to `PsiFile`
3. Find relevant element with `findElementAt()` or `PsiTreeUtil`
4. Analyze/resolve
5. If needed, modify inside write command

## PSI navigation examples

```java
PsiFile psiFile = PsiManager.getInstance(project).findFile(virtualFile);
PsiElement element = psiFile.findElementAt(offset);
PsiClass psiClass = PsiTreeUtil.getParentOfType(element, PsiClass.class);
Collection<PsiMethod> methods = PsiTreeUtil.findChildrenOfType(psiClass, PsiMethod.class);
```

## PSI creation and modification

### Creating Java PSI

Note: `PsiElementFactory` is Java-specific and requires a dependency on `com.intellij.modules.java`.

```java
PsiElementFactory factory = PsiElementFactory.getInstance(project);
PsiMethod method = factory.createMethodFromText(
    "public void hello() { System.out.println(\"Hello\"); }",
    psiClass
);
```

### Creating PSI files

Use `PsiFileFactory.createFileFromText()` for in-memory PSI creation. If the new file should be written into the project, add it through a directory inside a write command.

```java
PsiFile psiFile = PsiFileFactory.getInstance(project)
    .createFileFromText("demo.simple", YourFileType.INSTANCE, sourceText);

WriteCommandAction.runWriteCommandAction(project, () -> {
    PsiFile added = (PsiFile)psiDirectory.add(psiFile);
});
```

### Modifying PSI

```java
WriteCommandAction.runWriteCommandAction(project, () -> {
    psiClass.add(method);
});
```

### Modification guidance

- Prefer PSI factories instead of raw text replacement when possible
- Keep the modified scope as small as possible
- Reformat only the touched area when practical
- Coordinate PSI/document changes with `PsiDocumentManager` when both are involved
- When mixing PSI and document edits, `PsiDocumentManager.getInstance(project).doPostponedOperationsAndUnblockDocument(document)` is often required before further document mutation
- Do not create whitespace/import nodes manually in Java PSI — let the formatter and `JavaCodeStyleManager.shortenClassReferences()` handle them

## PSI tree change notifications

Use `PsiTreeChangeListener` when the feature reacts to structural PSI updates.

```java
PsiManager.getInstance(project).addPsiTreeChangeListener(new PsiTreeChangeAdapter() {
    @Override
    public void childrenChanged(@NotNull PsiTreeChangeEvent event) {
        // react to PSI change
    }
}, disposable);
```

Prefer disposable-scoped registration so listeners are removed automatically.

## File view providers

Use `FileViewProvider` when a physical file contains multiple PSI views or multiple languages (for example templating files or embedded-language scenarios). Do not assume one file always maps to exactly one PSI tree.

## References and resolution

### Core APIs

- `PsiReference`
- `PsiPolyVariantReference`
- `ResolveResult`
- `ReferencesSearch`
- `PsiReferenceContributor`
- `PsiReferenceProvider`

### Custom reference registration

Use a reference contributor when the user needs navigation, rename support, or usage search from custom strings/tokens.

### PsiPolyVariantReference

When a reference can resolve to multiple targets, implement `PsiPolyVariantReference` with `multiResolve()` returning `ResolveResult[]`. Use `PsiPolyVariantReferenceBase` as a convenience base class. `PsiReference.resolve()` returns `null` when resolution fails — code must handle this.

## Rename/find usages expectations

A good custom language or DSL integration usually needs:

- references that resolve reliably
- rename that updates declarations and usages
- find usages that shows meaningful element types and names

If the user asks for any of those, inspect references first before implementing UI behavior.

## Indexing overview

### File-based index

Use when you need a fast mapping from keys to files. Extend `FileBasedIndexExtension` and register via `com.intellij.fileBasedIndex` EP. The index uses Map/Reduce architecture — implement `getIndexer()`, `getKeyDescriptor()`, `getInputFilter()`, `getName()`, and `getVersion()`. Value-carrying indexes also need `getValueExternalizer()`. For simpler cases with no value, use `ScalarIndexExtension`.

### Stub index

Use when you need to find declarations/elements quickly without loading full PSI trees. Requires: (1) change file element type to `IStubFileElementType`, (2) define `StubElement` implementations, (3) make PSI extend `StubBasedPsiElement`, (4) extend `AbstractStubIndex` or `StringStubIndexExtension`. Access data via `StubIndex.getElements()`.

### Gists

Use file gists (`VirtualFileGist` or `PsiFileGist`) for lazily computed, cached per-file data when: (1) aggregation is not needed, (2) eager indexing of the whole project is unnecessary, and (3) the data can be recalculated lazily without significant cost.

## Indexing performance rules

- Avoid full AST when lighter structures are enough
- Prefer lexer/light AST for indexing work
- Traverse only the nodes you need
- Keep indexed payloads compact
- Never assume index access works during dumb mode

## PSI performance

### Avoid repeated method calls

PSI getter methods like `getArgumentList()`, `getExpressions()` are NOT simple getters — they traverse child linked lists and allocate arrays. In hot paths or when the result is reused, store it in a local variable instead of calling the same getter repeatedly.

### Avoid expensive PsiElement methods

- `getText()` traverses the entire subtree and concatenates strings — use `textMatches()` instead when comparing
- `getTextRange()`, `getContainingFile()`, `getProject()` traverse up to the file root — cache these if called repeatedly
- `getTextLength()` is cheaper than `getTextRange()` when you only need length
- `getText()`, `getNode()`, `getTextRange()` require the AST, which is expensive to load

### Minimize loaded ASTs

Ideally, only files open in the editor keep AST nodes in memory. For other files, prefer stub-backed PSI where possible. Use `AstLoadingFilter` in production and `PsiManagerEx.setAssertOnFileLoadingFilter()` in tests to detect accidental AST loading.

### Cache heavy computations

Use `CachedValuesManager` for expensive computations like resolve, type inference, or control flow:

```java
CachedValuesManager.getCachedValue(element, () -> {
    List<String> result = expensiveComputation(element);
    return CachedValueProvider.Result.create(
        result,
        PsiModificationTracker.getInstance(element.getProject())
    );
});
```

### ProjectRootManager dependency change (2024.1)

The platform no longer increments `ProjectRootManager`'s root modification tracker when dumb mode finishes. If cached values use `ProjectRootManager` as a dependency (without `PsiModificationTracker`) and also depend on indexes, add `DumbService` as an additional dependency.

## PSI cookbook (Java-specific)

These APIs require a dependency on `com.intellij.modules.java`.

| Task | API |
|------|-----|
| Find class by qualified name | `JavaPsiFacade.findClass()` |
| Find class by short name | `PsiShortNamesCache.getClassesByName()` |
| Find all inheritors | `ClassInheritorsSearch.search()` |
| Find overriding methods | `OverridingMethodsSearch.search()` |
| Find file by name | `FilenameIndex.getFilesByName()` |
| Get superclass | `PsiClass.getSuperClass()` |
| Get package name | `PsiUtil.getPackageName()` |
| Create class/interface in directory | `JavaDirectoryService` |
| Find Java PSI elements | Extend `JavaRecursiveElementVisitor` |
| Check library presence (cached) | `JavaLibraryUtil.hasLibraryClass()` (since 2023.2) |
| Rename element programmatically | `RefactoringFactory.createRename()` |
| Reparse file | `FileContentUtil.reparseFiles()` |

### UAST

For plugins that need to work across multiple JVM languages (Java, Kotlin, Groovy, Scala), consider using UAST (Unified Abstract Syntax Tree) instead of language-specific PSI. UAST provides a common API for structural code analysis across JVM languages.

## Dumb mode and PSI/indexes

If a feature depends on indexes:

- degrade gracefully in dumb mode
- defer with `runWhenSmart()`
- do not mark it `DumbAware` unless it is truly safe

## Common implementation patterns

### From editor caret to symbol

```java
Editor editor = e.getData(CommonDataKeys.EDITOR);
PsiFile file = e.getData(CommonDataKeys.PSI_FILE);
PsiElement element = file.findElementAt(editor.getCaretModel().getOffset());
```

### From reference to declaration

```java
PsiReference reference = file.findReferenceAt(offset);
PsiElement target = reference != null ? reference.resolve() : null;
```

### Search references

```java
Collection<PsiReference> refs = ReferencesSearch.search(target).findAll();
```

## When to prefer PSI over text processing

Use PSI when the task involves:

- declarations or references
- syntax-aware edits
- inspections or intentions
- rename/find usages
- code generation into structured language elements

Use raw text/document edits only when the structure is irrelevant or the file is not PSI-backed in a useful way.

## When to also read other references

- Read `language-support-and-analysis.md` for completion, annotators, inspections, intentions, formatter, and parser work
- Read `patterns.md` for reusable PSI/editor code patterns
- Read `troubleshooting.md` for `IndexNotReadyException`, write-action assertions, or invalid PSI issues
