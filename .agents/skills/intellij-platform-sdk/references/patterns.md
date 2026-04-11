# IntelliJ Platform Development Patterns

Common patterns and solutions for IntelliJ Platform plugin development.

## PSI Navigation Patterns

### Find Element at Caret

```java
public static PsiElement getElementAtCaret(@NotNull Editor editor,
                                           @NotNull PsiFile file) {
    int offset = editor.getCaretModel().getOffset();
    return file.findElementAt(offset);
}

public static <T extends PsiElement> T getParentOfType(
        @NotNull Editor editor,
        @NotNull PsiFile file,
        @NotNull Class<T> clazz) {
    PsiElement element = getElementAtCaret(editor, file);
    return PsiTreeUtil.getParentOfType(element, clazz);
}
```

### Find Children by Type

```java
// Find all methods in a class
Collection<PsiMethod> methods = PsiTreeUtil.findChildrenOfType(
    psiClass, PsiMethod.class);

// Find children of type with filtering
PsiTreeUtil.processElements(psiClass, element -> {
    if (element instanceof PsiAnnotation) {
        // Process annotation
        return true; // continue
    }
    return true;
});
```

### Navigate References

```java
// Find references to element
Collection<PsiReference> references =
    ReferencesSearch.search(psiElement).findAll();

// Find usages in scope
Query<PsiReference> query = ReferencesSearch.search(
    psiElement,
    GlobalSearchScope.projectScope(project)
);
```

## PSI Modification Patterns

### Safe Write Action

```java
public static void executeWriteCommand(
        @NotNull Project project,
        @NotNull String name,
        @Nullable PsiFile file,
        @NotNull Runnable action) {

    CommandProcessor.getInstance().executeCommand(
        project,
        () -> ApplicationManager.getApplication()
            .runWriteAction(action),
        name,
        null,
        UndoConfirmationPolicy.DEFAULT,
        file
    );
}
```

### Create and Add Element

```java
public static void addMethodToClass(
        @NotNull Project project,
        @NotNull PsiClass psiClass,
        @NotNull String methodText) {

    WriteCommandAction.runWriteCommandAction(project, () -> {
        PsiElementFactory factory =
            PsiElementFactory.getInstance(project);
        PsiMethod method = factory.createMethodFromText(
            methodText, psiClass);
        psiClass.add(method);
    });
}
```

### Replace Element

```java
public static void replaceElement(
        @NotNull Project project,
        @NotNull PsiElement oldElement,
        @NotNull String newText) {

    WriteCommandAction.runWriteCommandAction(project, () -> {
        PsiElementFactory factory =
            PsiElementFactory.getInstance(project);
        PsiElement newElement = factory.createExpressionFromText(
            newText, oldElement.getParent());
        oldElement.replace(newElement);
    });
}
```

Note: `PsiElementFactory` is Java PSI specific — requires a dependency on the Java plugin (`com.intellij.modules.java`).

## Caching Patterns

### Cached Value

```java
public class MyService {
    private final CachedValuesManager cachedValuesManager;

    public MyService(Project project) {
        cachedValuesManager = CachedValuesManager.getManager(project);
    }

    public List<String> getCachedData(@NotNull PsiFile file) {
        return cachedValuesManager.getCachedValue(
            file,
            () -> {
                // Expensive computation
                List<String> result = computeData(file);
                return CachedValueProvider.Result.create(
                    result,
                    PsiModificationTracker.getInstance(file.getProject())
                );
            }
        );
    }
}
```

### User Data

```java
// Store data on element
Key<String> MY_KEY = Key.create("my.data.key");
psiElement.putUserData(MY_KEY, "value");
String value = psiElement.getUserData(MY_KEY);

// Compute if absent
String value = psiElement.getUserData(MY_KEY);
if (value == null) {
    value = computeValue();
    psiElement.putUserData(MY_KEY, value);
}
```

## Editor Patterns

### Get Editor Content

```java
public static String getSelectedText(@NotNull Editor editor) {
    SelectionModel selectionModel = editor.getSelectionModel();
    if (selectionModel.hasSelection()) {
        return selectionModel.getSelectedText();
    }
    return null;
}

public static void insertText(@NotNull Editor editor,
                              @NotNull String text) {
    Document document = editor.getDocument();
    CaretModel caretModel = editor.getCaretModel();

    WriteCommandAction.runWriteCommandAction(
        editor.getProject(),
        () -> document.insertString(
            caretModel.getOffset(),
            text
        )
    );
}
```

### Modify Document

```java
public static void replaceRange(@NotNull Editor editor,
                                int startOffset,
                                int endOffset,
                                @NotNull String newText) {
    Document document = editor.getDocument();
    Project project = editor.getProject();

    WriteCommandAction.runWriteCommandAction(project, () -> {
        document.replaceString(startOffset, endOffset, newText);
        editor.getCaretModel().moveToOffset(startOffset + newText.length());
    });
}
```

## Virtual File Patterns

### Find File

```java
// By path
VirtualFile file = LocalFileSystem.getInstance()
    .findFileByPath("/path/to/file.java");

// By URL
VirtualFile file = VirtualFileManager.getInstance()
    .findFileByUrl("file:///path/to/file.java");

// By relative path from project root (getBaseDir() is deprecated)
VirtualFile baseDir = ProjectUtil.guessProjectDir(project);
VirtualFile file = baseDir != null
    ? baseDir.findFileByRelativePath("src/main/java") : null;
```

### Listen for Changes

Use message-bus-based `BulkFileListener` (preferred) or add a disposable-aware VFS listener.

**Important:** VFS listeners are application-level — they receive events for all open projects. Filter events by project when needed.

```java
// Preferred: BulkFileListener via message bus
project.getMessageBus().connect(disposable).subscribe(
    VirtualFileManager.VFS_CHANGES,
    new BulkFileListener() {
        @Override
        public void after(@NotNull List<? extends VFileEvent> events) {
            for (VFileEvent event : events) {
                if (event instanceof VFileContentChangeEvent) {
                    // handle content change
                }
            }
        }
    }
);

// Alternative: direct listener with disposable for cleanup
VirtualFileManager.getInstance().addVirtualFileListener(
    new VirtualFileListener() {
        @Override
        public void contentsChanged(@NotNull VirtualFileEvent event) {
            // Handle file change
        }
    },
    disposable // ensures cleanup on plugin unload
);
```

## Progress Patterns

Note: The `Task`/`ProgressManager.run()` pattern below is marked `@Obsolete` since 2024.1. For plugins targeting 2024.1+, prefer Kotlin coroutines with `withBackgroundProgress`. The pattern below remains valid for older platform targets.

### Background Task

```java
new Task.Backgroundable(
    project,
    "Processing...",
    true // canBeCancelled
) {
    @Override
    public void run(@NotNull ProgressIndicator indicator) {
        indicator.setIndeterminate(false);

        for (int i = 0; i < total; i++) {
            ProgressManager.checkCanceled(); // throws ProcessCanceledException if canceled

            indicator.setFraction((double) i / total);
            indicator.setText("Processing item " + i + " of " + total);

            // Do work
        }
    }

    @Override
    public void onSuccess() {
        // Called on EDT
        new Notification(
            "MyPlugin.Notifications", "Success", "Done!", NotificationType.INFORMATION
        ).notify(project);
    }
}.queue();  // preferred over ProgressManager.getInstance().run(task)
```

### Modal Task

```java
ProgressManager.getInstance().run(new Task.Modal(
    project,
    "Processing...",
    true
) {
    @Override
    public void run(@NotNull ProgressIndicator indicator) {
        // Blocking task with progress dialog
    }
});
```

## Dialog Patterns

### Input Dialog

```java
String input = Messages.showInputDialog(
    project,
    "Enter name:",
    "Input",
    Messages.getQuestionIcon()
);

if (input != null && !input.isEmpty()) {
    // Process input
}
```

### Yes/No/Cancel Dialog

```java
int result = Messages.showYesNoCancelDialog(
    project,
    "Do you want to save changes?",
    "Confirm",
    Messages.getQuestionIcon()
);

switch (result) {
    case Messages.YES:
        // Save and continue
        break;
    case Messages.NO:
        // Continue without saving
        break;
    case Messages.CANCEL:
        // Abort
        return;
}
```

### Custom Dialog

```java
public class MyDialog extends DialogWrapper {
    private final JTextField nameField = new JTextField();
    private final JCheckBox enabledBox = new JBCheckBox("Enabled");

    public MyDialog(@Nullable Project project) {
        super(project);
        init();
        setTitle("Configuration");
        setOKButtonText("Save");
    }

    @Nullable
    @Override
    protected JComponent createCenterPanel() {
        JPanel panel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.insets = JBUI.insets(5);

        gbc.gridx = 0;
        gbc.gridy = 0;
        panel.add(new JLabel("Name:"), gbc);

        gbc.gridx = 1;
        gbc.weightx = 1;
        panel.add(nameField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 1;
        gbc.gridwidth = 2;
        panel.add(enabledBox, gbc);

        return panel;
    }

    @Nullable
    @Override
    public JComponent getPreferredFocusedComponent() {
        return nameField;
    }

    public String getName() {
        return nameField.getText();
    }

    public boolean isEnabled() {
        return enabledBox.isSelected();
    }
}
```

## Threading Patterns

### Read Action with Result

```java
public static <T> T computeReadAction(@NotNull Computable<T> computable) {
    return ApplicationManager.getApplication()
        .runReadAction(computable);
}

// Usage
List<PsiClass> classes = computeReadAction(() -> {
    return findClasses(project);
});
```

### Non-Blocking Read Action

```java
ReadAction.nonBlocking(() -> {
    // Read action
    return computeExpensiveResult();
})
.inSmartMode(project) // add this if the read accesses file-based indexes
.finishOnUiThread(ModalityState.defaultModalityState(), result -> {
    // Handle result on EDT
    updateUI(result);
})
.submit(AppExecutorUtil.getAppExecutorService());
```

Use `.inSmartMode(project)` when the read performs PSI analysis, resolves references, or depends on indexes. This ensures the action waits for indexing to finish before executing.

### Invoke Later

```java
// On EDT
ApplicationManager.getApplication().invokeLater(() -> {
    // Update UI
});

// With modality state
ApplicationManager.getApplication().invokeLater(
    () -> { /* update UI */ },
    ModalityState.defaultModalityState()
);
```

## Tool Window Patterns

### Simple Tool Window

```java
public class MyToolWindowFactory implements ToolWindowFactory {
    @Override
    public void createToolWindowContent(
            @NotNull Project project,
            @NotNull ToolWindow toolWindow) {

        SimpleToolWindowPanel panel = new SimpleToolWindowPanel(false, true);

        // Content
        Tree tree = createTree(project);
        panel.setContent(ScrollPaneFactory.createScrollPane(tree));

        // Toolbar
        DefaultActionGroup group = new DefaultActionGroup();
        group.add(new RefreshAction());
        group.add(new AddAction());

        ActionToolbar toolbar = ActionManager.getInstance()
            .createActionToolbar("MyToolbar", group, true);
        toolbar.setTargetComponent(panel);
        panel.setToolbar(toolbar.getComponent());

        // Add content
        ContentFactory contentFactory = ContentFactory.getInstance();
        Content content = contentFactory.createContent(
            panel, "My Tab", false);
        content.setCloseable(false);

        toolWindow.getContentManager().addContent(content);
    }
}
```

### Tool Window with Multiple Tabs

```java
ContentFactory contentFactory = ContentFactory.getInstance();

Content tab1 = contentFactory.createContent(
    panel1, "Tab 1", false);
Content tab2 = contentFactory.createContent(
    panel2, "Tab 2", false);

toolWindow.getContentManager().addContent(tab1);
toolWindow.getContentManager().addContent(tab2);
```

## Notification Patterns

### Show Notification

```java
Notification notification = new Notification(
    "MyPlugin.Notifications",    // notification group ID (registered in plugin.xml)
    "Title",
    "Message content",
    NotificationType.INFORMATION
);

notification.addAction(NotificationAction.createSimple(
    "Open Settings",
    () -> ShowSettingsUtil.getInstance()
        .showSettingsDialog(project, "MyPlugin.Settings")
));

notification.notify(project);
```

### Balloon Notification

```java
new Notification(
    "MyPlugin.Notifications",
    "Title",
    "Message",
    NotificationType.INFORMATION
).notify(project);
```

## Completion Patterns

### Simple Completion

```java
public class MyCompletionContributor extends CompletionContributor {
    public MyCompletionContributor() {
        extend(CompletionType.BASIC,
            PlatformPatterns.psiElement()
                .withLanguage(JavaLanguage.INSTANCE)
                .withSuperParent(2, PsiMethodCallExpression.class),
            new CompletionProvider<>() {
                @Override
                protected void addCompletions(
                        @NotNull CompletionParameters parameters,
                        @NotNull ProcessingContext context,
                        @NotNull CompletionResultSet result) {

                    result.addElement(LookupElementBuilder
                        .create("myMethod")
                        .withTypeText("void")
                        .withIcon(AllIcons.Nodes.Method)
                        .withInsertHandler((insertCtx, item) -> {
                            // Position caret between parentheses
                            Editor editor = insertCtx.getEditor();
                            editor.getDocument().insertString(
                                insertCtx.getTailOffset(), "()"
                            );
                            editor.getCaretModel().moveToOffset(
                                insertCtx.getTailOffset() - 1
                            );
                        })
                    );
                }
            }
        );
    }
}
```
