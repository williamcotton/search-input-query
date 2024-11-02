import { useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import "./App.css";

function App() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof import("monaco-editor") | null>(null)
  const [rangeOffset, setRangeOffset] = useState(1);
  const [value, setValue] = useState<string | undefined>("// some comment");

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setMonaco(monaco);
    editor.createDecorationsCollection([
      {
        range: new monaco.Range(1, 4, 1, 10),
        options: { inlineClassName: "myInlineDecoration" },
      },
    ]);

    editor.addAction({
      id: "submitInSingleMode",
      label: "Submit in single mode",
      // Monaco ships with out of the box enums for keycodes and modifiers
      keybindings: [monaco.KeyCode.Enter],
      run: () => {
      const currentValue = editor.getValue();
      console.log(currentValue);
      },
    });
  };

  const onChange = (value: string | undefined) => {
    setValue(value);
    const editor = editorRef.current;
    setRangeOffset(rangeOffset + 1);
    return editor && monaco ? editor.createDecorationsCollection([
      {
        range: new monaco.Range(1, 4 + rangeOffset, 1, 10 + rangeOffset),
        options: { inlineClassName: "myInlineDecoration" },
      },
    ]) : null
  }

  return (
    <>
      <p>test</p>
      <Editor
        height="2.1em"
        width="90vh"
        defaultLanguage=""
        defaultValue={value}
        onMount={handleEditorDidMount}
        className="search-input"
        onChange={onChange}
        options={{
          renderLineHighlight: "none",
          quickSuggestions: false,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          folding: false,
          fixedOverflowWidgets: true,
          acceptSuggestionOnEnter: "on",
          hover: {
            delay: 100,
          },
          roundedSelection: false,
          contextmenu: false,
          cursorStyle: "line-thin",
          occurrencesHighlight: "off",
          links: false,
          minimap: { enabled: false },
          // see: https://github.com/microsoft/monaco-editor/issues/1746
          wordBasedSuggestions: "off",
          // disable `Find`
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: "never",
            seedSearchStringFromSelection: "never",
          },
          fontSize: 14,
          fontWeight: "normal",
          wordWrap: "off",
          lineNumbers: "off",
          lineNumbersMinChars: 0,
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollBeyondLastColumn: 0,
          scrollbar: {
            horizontal: "hidden",
            vertical: "hidden",
            // avoid can not scroll page when hover monaco
            alwaysConsumeMouseWheel: false,
          },
        }}
      />
      <p>test</p>
    </>
  );
}

export default App;
