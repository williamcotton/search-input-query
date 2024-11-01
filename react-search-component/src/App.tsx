import { useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import "./App.css";

function App() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.createDecorationsCollection([
      {
        range: new monaco.Range(1, 4, 1, 10),
        options: { inlineClassName: "myInlineDecoration" },
      },
    ]);

  };

  return (
    <>
      <Editor
        height="1.5em"
        width="90vh"
        defaultLanguage="javascript"
        defaultValue="// some comment"
        onMount={handleEditorDidMount}
        options={{
          minimap: {
            enabled: false,
            showSlider: "mouseover",
          },
          scrollBeyondLastLine: false,
          fontSize: 14,
          automaticLayout: true,
          lineNumbers: "off",
          glyphMargin: false,
          folding: false,
          renderLineHighlight: "none",
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          overviewRulerLanes: 0,
        }}
      />
    </>
  );
}

export default App;
