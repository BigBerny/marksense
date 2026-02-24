import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Parse a .env file at the given path into a key-value map.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (value) result[key] = value;
    }
  } catch {
    // file doesn't exist or isn't readable — that's fine
  }
  return result;
}

/**
 * Read Tiptap credentials from .env files.
 * Checks the extension's own directory first, then the workspace root.
 */
function readEnvFile(extensionPath: string): Record<string, string> {
  // 1) Extension's own .env (where the source code lives)
  const extEnv = parseEnvFile(path.join(extensionPath, ".env"));

  // 2) Current workspace .env (the folder open in VS Code)
  let wsEnv: Record<string, string> = {};
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    wsEnv = parseEnvFile(path.join(folders[0].uri.fsPath, ".env"));
  }

  // Extension .env takes priority, workspace .env as fallback
  return { ...wsEnv, ...extEnv };
}

/**
 * Check whether the given file resides inside a git repository.
 */
function isInsideGitRepo(filePath: string): boolean {
  try {
    execSync("git rev-parse --show-toplevel", {
      cwd: path.dirname(filePath),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the content of a file at HEAD using `git show`.
 * Returns null if the file is untracked, the repo doesn't exist, etc.
 */
function getGitHeadContent(filePath: string): string | null {
  try {
    const dir = path.dirname(filePath);
    // Get the repo root so we can compute the relative path
    const repoRoot = execSync("git rev-parse --show-toplevel", {
      cwd: dir,
      encoding: "utf-8",
    }).trim();
    const relativePath = path.relative(repoRoot, filePath);
    const content = execSync(`git show HEAD:${relativePath}`, {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    return content;
  } catch {
    // Not a git repo, file untracked, or no commits yet
    return null;
  }
}

/**
 * Virtual document provider for showing HEAD content in VS Code's diff editor.
 */
class GitHeadContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    // The URI path is the original file path — fetch HEAD content for it
    return getGitHeadContent(uri.fsPath) || "";
  }
}

// ─── Custom document ─────────────────────────────────────────────────

/**
 * Minimal document model.  We read the file ourselves (instead of relying
 * on VS Code's TextDocument model) which avoids a race condition where
 * VS Code's internal `$resolveCustomEditor` calls `getDocument(uri)`
 * before the text-document model has been synced during editor restoration.
 */
class MarkdownDocument implements vscode.CustomDocument {
  readonly uri: vscode.Uri;

  private _content: string;
  private _savedContent: string;

  constructor(uri: vscode.Uri, content: string) {
    this.uri = uri;
    this._content = content;
    this._savedContent = content;
  }

  /** Current (possibly unsaved) content. */
  get content(): string {
    return this._content;
  }

  /** Update in-memory content (does NOT write to disk). */
  set content(value: string) {
    this._content = value;
  }

  /** Whether there are unsaved changes. */
  get isDirty(): boolean {
    return this._content !== this._savedContent;
  }

  /** Mark current content as persisted. */
  markSaved(): void {
    this._savedContent = this._content;
  }

  /** Replace content with freshly-read file data (revert). */
  revert(diskContent: string): void {
    this._content = diskContent;
    this._savedContent = diskContent;
  }

  dispose(): void {
    // Nothing to clean up
  }
}

// ─── Editor provider ─────────────────────────────────────────────────

export class MarkdownEditorProvider
  implements vscode.CustomEditorProvider<MarkdownDocument>
{
  private static readonly viewType = "marksense.editor";

  /**
   * Fires when document content changes (marks it dirty in VS Code).
   * We use `CustomDocumentContentChangeEvent` (no VS Code undo/redo
   * integration) because Tiptap has its own undo/redo stack.
   */
  private readonly _onDidChangeCustomDocument =
    new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<MarkdownDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  /** Active webview panels keyed by document URI string. */
  private readonly webviewPanels = new Map<string, vscode.WebviewPanel>();

  public static register(
    context: vscode.ExtensionContext
  ): vscode.Disposable {
    // Register virtual document provider for showing HEAD content in diff editor
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        "marksense-head",
        new GitHeadContentProvider()
      )
    );

    const provider = new MarkdownEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      MarkdownEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  // ── CustomEditorProvider lifecycle ────────────────────────────────

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<MarkdownDocument> {
    const content = await fs.promises.readFile(uri.fsPath, "utf-8");
    return new MarkdownDocument(uri, content);
  }

  async resolveCustomEditor(
    document: MarkdownDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {

    // ── SCM diff redirect: detect non-file scheme (e.g. git:) ────────
    // When VS Code opens a diff from Source Control for a custom editor,
    // it opens two panels in a diff group. The "left" side uses a git:
    // scheme URI. We render a minimal placeholder, then close the diff
    // group and redirect to Marksense's built-in diff view.
    if (document.uri.scheme !== "file") {
      const filePath = document.uri.fsPath;
      const fileUri = vscode.Uri.file(filePath);
      const fileUriKey = fileUri.toString();

      // Render a lightweight placeholder (no Tiptap)
      webviewPanel.webview.html =
        "<!DOCTYPE html><html><body></body></html>";

      // When the diff group closes, redirect to the real editor with diff
      webviewPanel.onDidDispose(() => {
        // Brief delay so other dispose handlers (e.g. for the right panel)
        // run first, keeping webviewPanels map accurate.
        setTimeout(async () => {
          // Restore the file editor in normal mode if it was closed
          // with the diff group
          if (!this.webviewPanels.has(fileUriKey)) {
            await vscode.commands.executeCommand(
              "vscode.openWith",
              fileUri,
              "marksense.editor"
            );
          }
          // Open diff in a separate tab (becomes the active tab)
          this.openStandaloneDiffPanel(filePath);
        }, 50);
      });

      // Close the diff group immediately
      webviewPanel.dispose();

      return;
    }

    const uriKey = document.uri.toString();
    this.webviewPanels.set(uriKey, webviewPanel);

    // Allow the webview to load resources from both the extension dist
    // folder and the workspace (for user images and other local assets).
    const documentDir = vscode.Uri.file(path.dirname(document.uri.fsPath));
    const workspaceRoots =
      vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? [];

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        documentDir,
        ...workspaceRoots,
      ],
    };

    // Webview URI for the document's directory — used by the webview to
    // resolve relative image paths for display.
    const documentDirWebviewUri = webviewPanel.webview
      .asWebviewUri(documentDir)
      .toString();

    // Read extension settings, with .env file as fallback
    const config = vscode.workspace.getConfiguration("marksense");
    const env = readEnvFile(this.context.extensionUri.fsPath);
    const typewiseToken =
      config.get<string>("typewiseToken", "") || env["TYPEWISE_TOKEN"] || "";
    const aiProvider =
      config.get<string>("aiProvider", "offlinePreferred") || "offlinePreferred";
    const autoSaveDelay = config.get<number>("autoSaveDelay", 300);
    const defaultFullWidth = config.get<boolean>("defaultFullWidth", false);
    const debugTypewise = this.context.extensionMode === vscode.ExtensionMode.Development;
    const isGitRepo = isInsideGitRepo(document.uri.fsPath);

    // Generate the webview HTML
    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      document.content,
      { typewiseToken, aiProvider, autoSaveDelay, defaultFullWidth, documentDirWebviewUri, isGitRepo, debugTypewise }
    );

    // Send initial diff count after webview initializes
    if (isGitRepo) {
      setTimeout(() => {
        this.sendDiffCount(document, webviewPanel);
      }, 500);
    }


    // --- Sync: webview → document model ---

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    // When true, incoming "edit" messages from the webview are ignored.
    // This prevents stale debounced edits from overwriting an external change
    // that was just synced into the editor.
    let suppressEdits = false;

    const messageSubscription = webviewPanel.webview.onDidReceiveMessage(
      async (message: { type: string; [key: string]: unknown }) => {
        if (message.type === "edit" && typeof message.content === "string") {
          if (suppressEdits) return;

          if (debounceTimer) clearTimeout(debounceTimer);

          debounceTimer = setTimeout(() => {
            if (message.content === document.content) return;
            document.content = message.content as string;
            // Tell VS Code the document is dirty
            this._onDidChangeCustomDocument.fire({ document });
            // Update diff count from in-memory content
            if (isGitRepo) this.sendDiffCount(document, webviewPanel);
          }, autoSaveDelay);
        }

        // --- In-editor diff: send HEAD content to webview ---
        if (message.type === "requestHeadContent") {
          const headContent = getGitHeadContent(document.uri.fsPath);
          webviewPanel.webview.postMessage({
            type: "headContent",
            content: headContent,
          });
        }

        // --- Image upload: save file to disk and return relative path ---
        if (message.type === "uploadImage") {
          const id = message.id as string;
          const data = message.data as string;
          const filename = message.filename as string;

          try {
            const docDir = path.dirname(document.uri.fsPath);
            const imagesDir = path.join(docDir, "images");

            // Create images directory if it doesn't exist
            await fs.promises.mkdir(imagesDir, { recursive: true });

            // Pick a unique filename to avoid overwriting existing files
            let finalName = filename;
            let counter = 1;
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);

            while (fs.existsSync(path.join(imagesDir, finalName))) {
              finalName = `${base}-${counter}${ext}`;
              counter++;
            }

            // Decode base64 and write the file
            const buffer = Buffer.from(data, "base64");
            await fs.promises.writeFile(
              path.join(imagesDir, finalName),
              buffer
            );

            webviewPanel.webview.postMessage({
              type: "uploadImageResult",
              id,
              relativePath: `images/${finalName}`,
            });
          } catch (err: unknown) {
            const errMsg =
              err instanceof Error ? err.message : "Upload failed";
            console.error("[Marksense] Image upload failed:", err);
            webviewPanel.webview.postMessage({
              type: "uploadImageResult",
              id,
              error: errMsg,
            });
          }
        }
      }
    );

    // --- Watch for external file changes ---
    //
    // Three complementary mechanisms ensure we catch external edits:
    //
    // 1. FileSystemWatcher — fires for OS-level changes (external terminal,
    //    git checkout, etc.). Also handles some editors that delete + recreate
    //    files (onDidCreate).
    //
    // 2. workspace.onDidSaveTextDocument — fires when Cursor's built-in
    //    agents or other extensions edit & save the file through VS Code's
    //    TextDocument API. The file watcher may not catch these because
    //    VS Code can update its in-memory model before flushing to disk.
    //
    // 3. onDidChangeViewState — re-reads the file whenever the webview
    //    panel gains focus, catching any changes that slipped through.

    const syncFromDisk = async () => {
      try {
        const diskContent = await fs.promises.readFile(
          document.uri.fsPath,
          "utf-8"
        );
        if (diskContent !== document.content) {
          // Cancel any pending debounced save so it doesn't overwrite
          // the external change we're about to sync.
          if (debounceTimer) clearTimeout(debounceTimer);
          // Suppress incoming edits briefly — the webview may still have
          // a debounced "edit" message in flight from before the external
          // change was applied.
          suppressEdits = true;
          setTimeout(() => { suppressEdits = false; }, 500);

          document.revert(diskContent);
          webviewPanel.webview.postMessage({
            type: "update",
            content: diskContent,
          });
          // External change may be a commit — refresh HEAD cache
          this.refreshHeadCache(document);
          this.sendDiffCount(document, webviewPanel);
        }
      } catch {
        // File may have been deleted
      }
    };

    // (1) OS-level file watcher
    const fileDir = vscode.Uri.joinPath(document.uri, "..");
    const fileName = path.basename(document.uri.fsPath);
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(fileDir, fileName)
    );
    watcher.onDidChange(syncFromDisk);
    watcher.onDidCreate(syncFromDisk);

    // (2) VS Code TextDocument save events (e.g. Cursor agent edits)
    const textDocSub = vscode.workspace.onDidSaveTextDocument((td) => {
      if (td.uri.toString() === document.uri.toString()) {
        syncFromDisk();
      }
    });

    // (3) Re-read file when panel becomes visible / gains focus
    const viewStateSub = webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.visible) {
        syncFromDisk();
      }
    });

    // Clean up on dispose
    webviewPanel.onDidDispose(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      messageSubscription.dispose();
      watcher.dispose();
      textDocSub.dispose();
      viewStateSub.dispose();
      this.webviewPanels.delete(uriKey);
      this.headContentCache.delete(uriKey);
    });
  }

  // ── Diff count ─────────────────────────────────────────────────

  /** Cached HEAD content per document URI, for in-memory diff count. */
  private readonly headContentCache = new Map<string, string | null>();

  /**
   * Refresh the cached HEAD content for a document.
   * Called on open, save, and external sync.
   */
  private refreshHeadCache(document: MarkdownDocument): void {
    const key = document.uri.toString();
    this.headContentCache.set(key, getGitHeadContent(document.uri.fsPath));
  }

  /**
   * Send diff count to the webview by comparing in-memory document content
   * with the cached HEAD content. This works even before the file is saved.
   */
  private sendDiffCount(
    document: MarkdownDocument,
    panel: vscode.WebviewPanel
  ): void {
    if (!isInsideGitRepo(document.uri.fsPath)) return;

    const key = document.uri.toString();
    if (!this.headContentCache.has(key)) {
      this.refreshHeadCache(document);
    }
    const headContent = this.headContentCache.get(key);

    if (headContent == null) {
      // Untracked or no HEAD — no meaningful count
      panel.webview.postMessage({ type: "diffCount", count: 0 });
      return;
    }

    if (document.content === headContent) {
      panel.webview.postMessage({ type: "diffCount", count: 0 });
      return;
    }

    // Count differing lines (simple but fast)
    const headLines = headContent.split("\n");
    const docLines = document.content.split("\n");
    let count = Math.abs(headLines.length - docLines.length);
    const minLen = Math.min(headLines.length, docLines.length);
    for (let i = 0; i < minLen; i++) {
      if (headLines[i] !== docLines[i]) count++;
    }
    panel.webview.postMessage({ type: "diffCount", count: Math.max(count, 1) });
  }

  // ── Save / Revert / Backup ───────────────────────────────────────

  async saveCustomDocument(
    document: MarkdownDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    await fs.promises.writeFile(document.uri.fsPath, document.content, "utf-8");
    document.markSaved();
    // HEAD may have changed (e.g. commit just happened) — refresh cache
    this.refreshHeadCache(document);
    const panel = this.webviewPanels.get(document.uri.toString());
    if (panel) this.sendDiffCount(document, panel);
  }

  async saveCustomDocumentAs(
    document: MarkdownDocument,
    destination: vscode.Uri,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    await fs.promises.writeFile(
      destination.fsPath,
      document.content,
      "utf-8"
    );
  }

  async revertCustomDocument(
    document: MarkdownDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    const diskContent = await fs.promises.readFile(
      document.uri.fsPath,
      "utf-8"
    );
    document.revert(diskContent);

    // Push reverted content to the webview
    const panel = this.webviewPanels.get(document.uri.toString());
    if (panel) {
      panel.webview.postMessage({ type: "update", content: diskContent });
    }
  }

  async backupCustomDocument(
    document: MarkdownDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await fs.promises.writeFile(
      context.destination.fsPath,
      document.content,
      "utf-8"
    );
    return {
      id: context.destination.toString(),
      delete: () => {
        fs.promises.unlink(context.destination.fsPath).catch(() => {});
      },
    };
  }

  // ── Standalone diff panel ───────────────────────────────────────

  /**
   * Open a separate read-only webview tab showing the diff view.
   * Uses the same webview bundle but is not a custom editor, so it
   * doesn't conflict with the existing editor tab for the same file.
   */
  private openStandaloneDiffPanel(filePath: string): void {
    const headContent = getGitHeadContent(filePath);
    if (headContent === null) return;

    let currentContent: string;
    try {
      currentContent = fs.readFileSync(filePath, "utf-8");
    } catch {
      return;
    }

    const fileName = path.basename(filePath);
    const documentDir = vscode.Uri.file(path.dirname(filePath));
    const workspaceRoots =
      vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? [];

    const panel = vscode.window.createWebviewPanel(
      "marksense.diffView",
      `Changes: ${fileName}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "dist"),
          documentDir,
          ...workspaceRoots,
        ],
      }
    );

    const documentDirWebviewUri = panel.webview
      .asWebviewUri(documentDir)
      .toString();

    const config = vscode.workspace.getConfiguration("marksense");
    const env = readEnvFile(this.context.extensionUri.fsPath);

    panel.webview.html = this.getHtmlForWebview(panel.webview, currentContent, {
      typewiseToken:
        config.get<string>("typewiseToken", "") || env["TYPEWISE_TOKEN"] || "",
      aiProvider:
        config.get<string>("aiProvider", "offlinePreferred") ||
        "offlinePreferred",
      autoSaveDelay: config.get<number>("autoSaveDelay", 300),
      defaultFullWidth: config.get<boolean>("defaultFullWidth", false),
      documentDirWebviewUri,
      isGitRepo: true,
      debugTypewise:
        this.context.extensionMode === vscode.ExtensionMode.Development,
    });

    // Auto-enable diff mode once the webview is ready
    setTimeout(() => {
      panel.webview.postMessage({ type: "headContent", content: headContent });
    }, 500);

    // Handle re-requests (e.g. user closes and re-opens diff within the tab)
    panel.webview.onDidReceiveMessage((message) => {
      if (message.type === "requestHeadContent") {
        const fresh = getGitHeadContent(filePath);
        panel.webview.postMessage({ type: "headContent", content: fresh });
      }
    });
  }

  // ── HTML generation ──────────────────────────────────────────────

  private getHtmlForWebview(
    webview: vscode.Webview,
    initialContent: string,
    settings: {
      typewiseToken: string;
      aiProvider: string;
      autoSaveDelay: number;
      defaultFullWidth: boolean;
      documentDirWebviewUri: string;
      isGitRepo: boolean;
      debugTypewise: boolean;
    }
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.css")
    );

    // Typewise SDK assets (loaded as a separate script + served as static files)
    const sdkBaseUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "typewise-sdk")
    ).toString();
    const typewiseSdkScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "typewise-sdk", "typewise.js")
    );

    const nonce = getNonce();

    // Escape the initial content for safe embedding in HTML
    const escapedContent = JSON.stringify(initialContent);

    const allSettings = { ...settings, typewiseSdkBaseUri: sdkBaseUri };

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource} https: data:;
    style-src ${webview.cspSource} 'unsafe-inline';
    font-src ${webview.cspSource};
    script-src 'nonce-${nonce}' 'wasm-unsafe-eval' ${webview.cspSource};
    worker-src blob: ${webview.cspSource};
    connect-src https://api.tiptap.dev https://*.tiptap.dev https://api.typewise.ai ${webview.cspSource};
  ">
  <style>
    /* Match VS Code theme instantly so there is no white flash. */
    html, body {
      background-color: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      margin: 0;
      padding: 0;
    }
  </style>
  <link href="${styleUri}" rel="stylesheet">
  <title>Marksense</title>
</head>
<body>
  <script nonce="${nonce}">
    // Sync the .dark class on <html> with VS Code's theme.
    // VS Code adds "vscode-dark" / "vscode-light" to <body> and updates
    // it when the user switches themes. A MutationObserver keeps the
    // Tiptap .dark class in sync at all times.
    (function() {
      function syncTheme() {
        var isDark = document.body.classList.contains('vscode-dark');
        document.documentElement.classList.toggle('dark', isDark);
      }
      syncTheme();
      new MutationObserver(syncTheme)
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    })();
  </script>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__INITIAL_CONTENT__ = ${escapedContent};
    window.__SETTINGS__ = ${JSON.stringify(allSettings)};
  </script>
  <script nonce="${nonce}" src="${typewiseSdkScriptUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
