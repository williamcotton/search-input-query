import { editor } from "monaco-editor";

export class PlaceholderContentWidget implements editor.IContentWidget {
  private static readonly ID = "editor.widget.placeholderHint";
  private domNode: HTMLElement | undefined;

  constructor(
    private readonly placeholder: string,
    private readonly editor: editor.ICodeEditor
  ) {
    editor.onDidChangeModelContent(() => this.onDidChangeModelContent());
    this.onDidChangeModelContent();
  }

  private onDidChangeModelContent(): void {
    if (this.editor.getValue() === "") {
      this.editor.addContentWidget(this);
    } else {
      this.editor.removeContentWidget(this);
    }
  }

  getId(): string {
    return PlaceholderContentWidget.ID;
  }

  getDomNode(): HTMLElement {
    if (!this.domNode) {
      this.domNode = document.createElement("div");
      this.domNode.style.width = "max-content";
      this.domNode.style.pointerEvents = "none";
      this.domNode.textContent = this.placeholder;
      this.domNode.style.fontStyle = "italic";
      this.domNode.style.color = "#666";
      this.editor.applyFontInfo(this.domNode);
    }
    return this.domNode;
  }

  getPosition(): editor.IContentWidgetPosition {
    return {
      position: { lineNumber: 1, column: 1 },
      preference: [editor.ContentWidgetPositionPreference.EXACT],
    };
  }

  dispose(): void {
    this.editor.removeContentWidget(this);
  }
}
