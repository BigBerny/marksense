import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

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

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "markdownTiptap.editor";

  public static register(
    context: vscode.ExtensionContext
  ): vscode.Disposable {
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

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
      ],
    };

    // Read extension settings, with .env file as fallback
    const config = vscode.workspace.getConfiguration("markdownTiptap");
    const env = readEnvFile(this.context.extensionUri.fsPath);
    const aiAppId =
      config.get<string>("aiAppId", "") || env["TIPTAP_AI_APP_ID"] || "";
    const aiToken =
      config.get<string>("aiToken", "") || env["TIPTAP_AI_TOKEN"] || "";
    const typewiseToken = env["TYPEWISE_TOKEN"] || "";
    const autoSaveDelay = config.get<number>("autoSaveDelay", 300);

    // Generate the webview HTML
    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      document.getText(),
      { aiAppId, aiToken, typewiseToken, autoSaveDelay }
    );

    // --- Bidirectional sync ---

    // Flag to track self-initiated edits (prevents update loops)
    let isSelfEdit = false;
    // Debounce timer for webview -> document sync
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    // Listen for messages from the webview
    const messageSubscription = webviewPanel.webview.onDidReceiveMessage(
      async (message: { type: string; content?: string }) => {
        if (message.type === "edit" && message.content !== undefined) {
          // Debounce the document update
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(async () => {
            const currentText = document.getText();
            if (message.content === currentText) {
              return; // No change needed
            }

            isSelfEdit = true;
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
              document.positionAt(0),
              document.positionAt(currentText.length)
            );
            edit.replace(document.uri, fullRange, message.content!);
            await vscode.workspace.applyEdit(edit);
            isSelfEdit = false;
          }, autoSaveDelay);
        }
      }
    );

    // Listen for external document changes (undo, redo, external edits)
    const documentChangeSubscription =
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (
          e.document.uri.toString() === document.uri.toString() &&
          !isSelfEdit &&
          e.contentChanges.length > 0
        ) {
          webviewPanel.webview.postMessage({
            type: "update",
            content: document.getText(),
          });
        }
      });

    // Clean up on dispose
    webviewPanel.onDidDispose(() => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      messageSubscription.dispose();
      documentChangeSubscription.dispose();
    });
  }

  private getHtmlForWebview(
    webview: vscode.Webview,
    initialContent: string,
    settings: {
      aiAppId: string
      aiToken: string
      typewiseToken: string
      autoSaveDelay: number
    }
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.css")
    );

    const nonce = getNonce();

    // Escape the initial content for safe embedding in HTML
    const escapedContent = JSON.stringify(initialContent);

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
    script-src 'nonce-${nonce}';
    connect-src https://api.tiptap.dev https://*.tiptap.dev https://api.typewise.ai;
  ">
  <link href="${styleUri}" rel="stylesheet">
  <title>Tiptap Markdown Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__INITIAL_CONTENT__ = ${escapedContent};
    window.__SETTINGS__ = ${JSON.stringify(settings)};
  </script>
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
