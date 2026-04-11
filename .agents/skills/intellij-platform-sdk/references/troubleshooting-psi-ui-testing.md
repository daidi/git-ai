# PSI, UI, Testing, and Debugging Troubleshooting

Use this reference when the problem is about PSI validity, write actions, dumb mode, editor/document coordination, UI updates, memory leaks, test fixtures, or local debugging.

## PSI issues

### Null pointer or invalid PSI access

Common causes:

- missing read access
- invalid/disposed PSI element
- attempting to use PSI before parsing/indexing state is ready

Pattern:

```java
PsiElement element = ReadAction.compute(() -> psiFile.findElementAt(offset));
if (element == null || !element.isValid()) {
    return;
}
```

### `Write access is allowed inside write-action only`

For PSI modifications, run on EDT inside a write action and command. `WriteCommandAction` is a common wrapper when the change should participate in undo/redo.

```java
WriteCommandAction.runWriteCommandAction(project, () -> {
    psiClass.add(method);
});
```

### `IndexNotReadyException`

You are likely touching an index-backed API during dumb mode.

A practical order of fixes is:

1. make the feature `DumbAware` only when it is truly safe
2. avoid index-backed work during dumb mode when possible
3. if the work must wait for indexes, defer it with `runWhenSmart()`

```java
if (DumbService.isDumb(project)) {
    DumbService.getInstance(project).runWhenSmart(() -> {
        // retry when smart
    });
    return;
}
```

For actions, extend `DumbAwareAction` instead of `AnAction` (do not override `AnAction.isDumbAware()`). For tool windows, implement `DumbAware` on the `ToolWindowFactory`.

## Editor/document issues

### `Document is locked by write PSI operations`

If PSI and document updates are being mixed, coordinate them with `PsiDocumentManager` and only use `doPostponedOperationsAndUnblockDocument()` when postponed PSI/document operations really need to be flushed before further document work.

```java
PsiDocumentManager.getInstance(project)
    .doPostponedOperationsAndUnblockDocument(document);
```

### Caret position wrong after edit

Explicitly move the caret and optionally scroll to it after the write completes.

## Testing issues

### Fixture is null or not initialized

Call `super.setUp()` and configure test content before invoking highlighting/completion/etc.

### Test data path problems

Return a deterministic `getTestDataPath()` and keep test data under `src/test/testData` when possible.

### Heavy test required

If a feature depends on a fuller platform/project environment, switch from a light fixture to `HeavyPlatformTestCase`.

## UI issues

### Dialog too small / content clipped

Set minimum or preferred sizes in dialog initialization when layout alone is insufficient.

### UI not refreshing

Update UI on EDT and call `revalidate()` / `repaint()` where appropriate.

```java
ApplicationManager.getApplication().invokeLater(() -> {
    label.setText(newText);
    panel.revalidate();
    panel.repaint();
});
```

## Memory leaks

Common causes:

- static fields holding `Project`, `Editor`, or PSI
- listeners not disposed
- long-lived objects caching short-lived IDE state

Use disposables and lifecycle-aware services instead.

```java
Disposer.register(parent, () -> {
    // cleanup
});
```

## Debugging tips

### Enable internal mode

From the main menu, select `Help | Edit Custom Properties...` to open (or create) `idea.properties`, then add:

```properties
idea.is.internal=true
```

Save and restart the IDE. After restart, the Internal Actions menu becomes available from the main menu / Find Action, depending on the IDE build.

### Useful debugging flows

- run `runIde` with debugger attached
- inspect PSI structure using internal tools or PSI viewer
- inspect extension points from diagnostic tools
- use debug flags or profiler args for sandbox IDE runs

## Threading error example

### `Access is allowed from event dispatch thread only`

This usually means UI work is happening off EDT.

```java
ApplicationManager.getApplication().invokeLater(() -> {
    // UI code
});
```

## PSI performance issues

### Slow highlighting or completion

Common causes:

- calling expensive PSI methods repeatedly (`getText()`, `getContainingFile()`, `getProject()`)
- loading too many ASTs into memory simultaneously
- not caching heavy computations with `CachedValuesManager`
- redundant index access in tight loops

Use `AstLoadingFilter` to detect accidental AST loading. Profile with IDE Perf plugin.

### Stale cached values after indexing (2024.1+)

If cached values use `ProjectRootManager` as a dependency and also depend on indexes, add `DumbService` as an additional dependency — the platform no longer increments root modification tracker when dumb mode finishes.

## See also

- `platform-basics.md`
- `psi-and-indexing.md`
- `ui-settings-and-toolwindows.md`
- `testing-and-publishing.md`
- `patterns.md`
