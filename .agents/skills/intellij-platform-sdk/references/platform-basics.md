# Platform Basics: Actions, Services, VFS, Threading

Use this reference when the user works on general plugin architecture, actions, services, files, background tasks, threading rules, dynamic plugins, or coroutine patterns.

## What this file covers

- Action System
- Services
- Virtual File System
- Read/write actions
- Kotlin coroutine patterns
- dumb mode awareness
- dynamic plugin support
- platform-wide architectural guardrails

## Action System

### Core classes

- `AnAction`
- `DumbAwareAction`
- `ToggleAction`
- `DefaultActionGroup`
- `AnActionEvent`
- `Presentation`
- `ActionUpdateThread`

### Action implementation rules

1. Override `actionPerformed()`
2. Override `update()` for visibility/enabled state
3. When targeting 2022.3 or later, override `getActionUpdateThread()`
4. Keep `update()` extremely fast

### Important rule: no fields in `AnAction`

`AnAction` instances live for the lifetime of the application. Do not store project/editor/file state in fields. That causes leaks and stale state.

### Basic action example

```java
public class HelloWorldAction extends AnAction {
    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        Messages.showMessageDialog(project, "Hello", "Title", Messages.getInformationIcon());
    }

    @Override
    public void update(@NotNull AnActionEvent e) {
        e.getPresentation().setEnabledAndVisible(e.getProject() != null);
    }

    @Override
    public @NotNull ActionUpdateThread getActionUpdateThread() {
        return ActionUpdateThread.BGT;
    }
}
```

### Choosing `ActionUpdateThread`

- Use `BGT` when `update()` needs PSI, VFS, or project-model reads
- Use `EDT` when `update()` needs Swing/UI state directly
- Prefer `BGT` for most modern actions

### Action data context

Access contextual data via `AnActionEvent`:

- `e.getData(CommonDataKeys.PROJECT)` — current project
- `e.getData(CommonDataKeys.EDITOR)` — current editor
- `e.getData(CommonDataKeys.PSI_FILE)` — current PSI file
- `e.getData(CommonDataKeys.VIRTUAL_FILE)` — current virtual file
- `e.getData(PlatformDataKeys.SELECTED_ITEM)` — selected item
- `e.getData(CommonDataKeys.NAVIGATABLE_ARRAY)` — selected navigatables

BGT update: has read access to PSI/VFS/project models, NO Swing access.
EDT update: has Swing access. PSI/VFS access is technically possible but discouraged — it causes UI freezes and the platform is progressively restricting it.

## Services

### Service levels

- Application service: one per IDE instance
- Project service: one per project
- Module service: one per module (**not recommended** — increases memory usage for projects with many modules)

### Modern service declaration

Light services use `@Service` directly and do not need `plugin.xml` registration. The class must be `final`. `@Service` without a level parameter defaults to application-level.

```java
@Service(Service.Level.PROJECT)
public final class MyProjectService {
    private final Project project;

    public MyProjectService(Project project) {
        this.project = project;
    }

    public static MyProjectService getInstance(Project project) {
        return project.getService(MyProjectService.class);
    }
}
```

### Service guidance

- Prefer light services with `@Service`
- The service class must be `final` for light services
- Do not inject dependency services via constructors — acquire them on-demand via `getService()` when needed
- Avoid eager heavy initialization in constructors
- Do not use old `ServiceManager` APIs in new code
- Put reusable logic in services instead of static helpers inside actions
- Do not cache service instances in `AnAction` fields or in static global state
- In other components, whether to cache a service depends on using the correct lifecycle/scope
- Cyclic service initialization throws `PluginException` — break cycles by deferring retrieval
- Service retrieval does not need a read action and can be called from any thread

## Virtual File System

The VFS is an application-level persistent snapshot of the file system. It may not reflect real-time disk contents — a refresh operation syncs changes from disk into the VFS.

### Key classes

- `VirtualFile`
- `VirtualFileManager`
- `LocalFileSystem`
- `VfsUtil`
- `BulkFileListener`
- `AsyncFileListener`

### Common operations

```java
VirtualFile file = LocalFileSystem.getInstance().findFileByPath(path);
PsiFile psiFile = PsiManager.getInstance(project).findFile(file);
```

### File event listening

Use `BulkFileListener` subscribed to `VirtualFileManager.VFS_CHANGES` for efficient file event listening. VFS listeners are application-level and receive events from all projects — filter with `ProjectFileIndex.isInContent()` when needed.

## Disposer / Disposable

`Disposable` is the platform's resource cleanup mechanism. `Disposer.register(parent, child)` creates a parent-child tree — when the parent is disposed, all children are disposed automatically.

### Rules

- **Never use `Application` or `Project` directly as parent disposable** in plugin code — causes classloader leaks on plugin unload. Use a project/application-level service instead.
- **Default to `Disposer.dispose(disposable)` instead of calling `Disposable.dispose()` directly** — this keeps disposer-tree semantics explicit and consistent.
- Services that implement `Disposable` are disposed when their scope ends (app shutdown or project close).
- Do not assume objects registered via `plugin.xml` automatically participate in the `Disposer` tree — explicitly manage the lifecycle of listeners, connections, and UI resources you create.
- Children are always disposed before their parents.
- Use `Disposer.newDisposable()` for manual lifecycle management when no natural parent exists.

### Choosing a parent disposable

- **Plugin lifetime** — use a project or application service
- **Dialog lifetime** — use `DialogWrapper.getDisposable()`
- **Tool window content** — use `Content.setDisposer()`
- **Message bus connections** — always pass parent disposable to `MessageBus.connect(disposable)`

## Messaging infrastructure

The messaging system provides a publisher/subscriber mechanism for loosely coupled communication between components.

### Core concepts

- `Topic<L>` — a named channel with a listener interface `L`
- `MessageBus` — obtained from `Application` or `Project`
- `MessageBusConnection` — a subscriber connection; always pass a parent `Disposable`

### Subscribing to events

```java
project.getMessageBus()
    .connect(disposable)
    .subscribe(VirtualFileManager.VFS_CHANGES, new BulkFileListener() {
        @Override
        public void after(@NotNull List<? extends VFileEvent> events) {
            // handle events
        }
    });
```

### Publishing events

```java
MyListener publisher = project.getMessageBus()
    .syncPublisher(MY_TOPIC);
publisher.onEvent(data);
```

### Guidance

- Prefer declarative listener registration in `plugin.xml` (`<applicationListeners>`, `<projectListeners>`) for performance (lazy creation)
- Listeners must be **stateless** and must **NOT** implement `Disposable`
- Project-level listeners can accept `Project` in their constructor
- Always use disposable-based connections for cleanup

## Logging

Use the platform `Logger` abstraction rather than direct log4j usage.

### Common patterns

```java
private static final Logger LOG = Logger.getInstance(MyClass.class);
```

```kotlin
private val LOG = logger<MyClass>()
```

```kotlin
try {
    doWork()
}
catch (e: Exception) {
    thisLogger().error("Work failed", e)
}
```

### Guidance

- Use a dedicated class-scoped logger for normal logging: `Logger.getInstance(MyClass.class)` in Java or `logger<MyClass>()` in Kotlin
- Use `thisLogger()` mainly as a convenience for exception reporting, typically inside `catch` blocks
- Guard expensive debug/trace message construction when needed

## Threading model

### Core rule

The platform uses a three-tier lock system: Read Lock, Write Intent Lock, and Write Lock.

- Read PSI/VFS/project model under read access
- Modify PSI/documents under write access (always on EDT)
- UI changes belong on EDT
- EDT currently implies Write Intent Lock, but that should not be treated as a blanket recommendation to perform arbitrary PSI/VFS/project-model reads on EDT; keep such reads short and move substantial work off the UI thread

### Read/write examples

```java
// General read action
ApplicationManager.getApplication().runReadAction(() -> {
    // safe reads
});

// Write action (general-purpose, no undo)
WriteAction.run(() -> {
    // general write operation
});

// Write command action (for PSI/document modification, supports undo)
WriteCommandAction.runWriteCommandAction(project, () -> {
    // PSI/document modification with undo support
});
```

Use `WriteCommandAction` for PSI/document modifications that need undo support. Use `WriteAction.run()` or `WriteAction.compute()` for other write operations.

### Non-blocking reads

Use `ReadAction.nonBlocking()` for read operations that may take noticeable time. The action gets canceled automatically when a write action arrives, then restarts. For plugins targeting 2024.1+, prefer the coroutine-based `readAction` (WARA) API instead.

### Background processes / Progress API

Use background tasks for work that may take noticeable time or needs cancellation/progress reporting.

```java
new Task.Backgroundable(project, "Processing Files", true) {
    @Override
    public void run(@NotNull ProgressIndicator indicator) {
        indicator.setIndeterminate(false);

        for (int i = 0; i < total; i++) {
            ProgressManager.checkCanceled();
            indicator.setFraction((double)i / total);
            indicator.setText("Processing " + (i + 1) + " / " + total);

            // background work
        }
    }
}.queue();
```

- `Task.Backgroundable` is the standard Java pattern for cancellable background work with progress
- `ProgressIndicator` exposes cancellation and progress updates via `setText()`, `setText2()`, `setFraction()`, and `setIndeterminate()`
- Call `ProgressManager.checkCanceled()` regularly in loops and deeper processing
- If `ProcessCanceledException` is caught, rethrow it — do not log or swallow it
- For Kotlin plugins targeting 2024.1+, prefer coroutine-based progress helpers such as `withBackgroundProgress` when appropriate

### ModalityState basics for `invokeLater`

Use `ApplicationManager.getApplication().invokeLater()` instead of `SwingUtilities.invokeLater()` when the runnable may interact with IDE models or lead to write work on EDT.

```java
ApplicationManager.getApplication().invokeLater(
    () -> updateUiOrScheduleWrite(project),
    ModalityState.defaultModalityState()
);
```

- `defaultModalityState()` is the usual default
- `nonModal()` runs only when no modal dialog is showing
- `current()` ties execution to the current dialog stack
- `any()` ignores modal dialogs and is only safe for pure UI work — never for PSI/VFS/project-model changes

### Slow operations on EDT

Keep EDT work short. Do not perform VFS traversal, PSI resolve, reference search, or index-heavy work directly on EDT.

- `SlowOperations.assertSlowOperationsAreAllowed()` reports code paths that should be moved off EDT
- Treat these assertions as real problems even if they currently appear only in internal, dev, or EAP builds
- Move the slow part to a background task, pooled thread, or coroutine, then switch back to EDT only for UI updates

### Object validity between read actions

Objects read in one read action are not guaranteed to remain valid across later read actions.

- Re-check `isValid()` when entering a new read action
- Re-resolve PSI from stable handles such as `VirtualFile` instead of caching raw PSI across async boundaries
- Use `SmartPsiElementPointer` when a PSI element must survive document changes or background/EDT handoffs
- Keep read actions short and derive fresh objects inside the read action that uses them

### Kotlin coroutines

For Kotlin plugins on 2024.1+, prefer coroutine-based APIs over the Java threading patterns above.

#### Service-scoped coroutines (recommended)

Inject a `CoroutineScope` tied to the service lifecycle:

```kotlin
@Service(Service.Level.PROJECT)
class MyProjectService(
    private val project: Project,
    private val cs: CoroutineScope
) {
    fun doWork() {
        cs.launch {
            val data = readAction {
                // short read action
            }
            withContext(Dispatchers.EDT) {
                // update UI
            }
        }
    }
}
```

#### Read/write suspend APIs

```kotlin
// Short read — Write Allowing Read Action (WARA)
// Canceled and retried when a write action arrives; preferred for most reads
val text = readAction { psiFile.text }

// Long read — Write Blocking Read Action (WBRA)
// Blocks write actions until done; use sparingly for heavy index work
val result = readActionBlocking { processLargeIndex() }

// Smart read (waits for dumb mode to end, then reads)
val symbols = smartReadAction(project) { findSymbols() }

// Smart read blocking variant
val data = smartReadActionBlocking(project) { heavyIndexLookup() }

// Constrained read (specify additional constraints)
val data = constrainedReadAction(ReadConstraint.inSmartMode(project)) {
    findDeclarations()
}

// Read-then-write (atomic — no write action can intervene between read and write)
readAndWriteAction {
    val element = findElement()
    writeAction { modifyElement(element) }
}

// Write action
writeAction { psiClass.add(method) }
```

The key distinction: `readAction` (WARA) yields to write actions — if a write arrives, the read is canceled and retried automatically. `readActionBlocking` (WBRA) prevents writes until it finishes. Prefer WARA for most cases; only use WBRA when reads cannot be restarted cheaply.

#### Dispatchers

- `Dispatchers.Default` — CPU-intensive work
- `Dispatchers.IO` — file/network I/O
- `Dispatchers.EDT` — UI updates on Event Dispatch Thread

#### Action coroutines (since 2024.2)

```kotlin
class MyAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        currentThreadCoroutineScope().launch {
            val targets = readAction { findTargets(e.project!!) }
            withContext(Dispatchers.EDT) { showResults(targets) }
        }
    }
}
```

`currentThreadCoroutineScope()` in actions is available since 2024.2. For 2024.1, use service-scoped coroutines instead.

#### Avoid deprecated patterns

Do not use `Application.getCoroutineScope()` or `Project.getCoroutineScope()` directly — these are deprecated and cause two kinds of leaks: (1) plugin classloader leaks because the scope outlives the plugin, and (2) project leaks when an application-scoped coroutine holds a project reference after close. Always use the injected `CoroutineScope` from service constructors or `currentThreadCoroutineScope()` in actions (2024.2+).

## Dumb mode

During indexing, many index-backed operations are unavailable.

### Use these patterns

- `DumbService.isDumb(project)`
- `DumbService.getInstance(project).runWhenSmart { ... }`
- `DumbService.getInstance(project).smartInvokeLater { ... }`
- `DumbAwareAction` or `DumbAware` where appropriate (do not override `AnAction.isDumbAware()` — extend `DumbAwareAction` instead)

### Important nuance

Only mark code `DumbAware` if it really avoids index-dependent APIs.

## Dynamic plugins

Dynamic plugins can be installed, updated, and unloaded without restarting the IDE. To support this:

### Requirements

1. **No components** — migrate all components to services, extensions, or listeners
2. **Action groups must have IDs** — every `<group>` in `plugin.xml` needs a unique `id`
3. **Use only dynamic extension points** — all referenced EPs must be marked dynamic
4. **No service overrides** — services with `overrides="true"` prevent dynamic loading
5. **Proper resource cleanup** — use `Disposable` services, not static state
6. **Configurable EP dependencies** — any `Configurable` depending on dynamic EPs must implement `Configurable.WithEpDependencies`

### Coding rules for dynamic compatibility

- Do not store `Project`, `Editor`, or PSI in static fields
- Do not use `FileType` or `Language` instances as `Map` keys — use their string IDs instead
- Use `SmartPsiElementPointer` instead of holding `PsiElement` references
- Register listeners via `plugin.xml` or disposable connections, not static subscriptions
- `CachedValuesManager`-created cached values are automatically invalidated on plugin unload

### Plugin lifecycle listener

```kotlin
class MyDynamicPluginListener : DynamicPluginListener {
    override fun beforePluginUnload(
        pluginDescriptor: IdeaPluginDescriptor,
        isUpdate: Boolean
    ) {
        // cancel long-running tasks, release resources
    }
}
```

Register in `plugin.xml`:

```xml
<applicationListeners>
    <listener class="com.example.MyDynamicPluginListener"
              topic="com.intellij.ide.plugins.DynamicPluginListener"/>
</applicationListeners>
```

### Debugging dynamic unload issues

Start the IDE with VM parameter `-XX:+UnlockDiagnosticVMOptions`, enable internal mode, and set registry key `ide.plugins.snapshot.on.unload.fail` to `true`. On unload failure a `.hprof` heap snapshot is generated in the user home directory. Open it, find the `PluginClassLoader` referencing your plugin ID — every reference to it is a memory leak. Check logs under category `com.intellij.ide.plugins.DynamicPlugins`.

## Architecture heuristics

When helping the user implement a feature:

1. Put one-shot UI entrypoints in actions
2. Put reusable business logic in services
3. Put PSI operations behind clear helpers or service methods
4. Separate fast context checks from heavy execution
5. Respect dumb mode and thread boundaries first, optimize later

## When to also read other references

- Read `psi-and-indexing.md` for PSI traversal, references, and custom indexes
- Read `ui-settings-and-toolwindows.md` for dialogs, settings, and tool windows
- Read `troubleshooting.md` if actions are invisible, services fail, or threading assertions appear
