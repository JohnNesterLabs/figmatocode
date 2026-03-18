import { useState, useCallback, useRef } from "react";
import { patchComponentStyle, patchComponentText, patchTextInStringLiterals, applyAIEdit, PatchOptions } from "@/lib/codePatcher";

export interface SelectedElement {
  selector: string;
  tagName: string;
  className: string;
  innerHTML: string;
  textContent: string;
  computedStyles: Record<string, string>;
  boundingClientRect: { top: number; left: number; width: number; height: number };
  inlineStyle: string;
}

export interface VisualEditState {
  isVisualEditMode: boolean;
  selectedElement: SelectedElement | null;
  isApplyingEdit: boolean;
  editError: string | null;
}

export interface UseVisualEditOptions {
  /** Called when an edit produces new file contents to write */
  onFileUpdate: (fileName: string, newContent: string) => void;
  /** Get current file content by name */
  getFileContent: (fileName: string) => string | undefined;
  /** The primary component file name (e.g. "src/components/Button.tsx") */
  componentFileName: string | null;
  /**
   * Optional fallback files to patch when the selected element isn't inside the primary component file.
   * Example: the preview template header lives in `src/App.tsx`.
   */
  fallbackFileNames?: string[];
}

export interface UseVisualEditResult extends VisualEditState {
  enterEditMode: () => void;
  exitEditMode: () => void;
  handleElementSelect: (element: SelectedElement) => void;
  applyStyleEdit: (prop: string, value: string) => void;
  applyTextEdit: (newText: string) => void;
  applyAIEditResult: (newCode: string) => void;
  clearError: () => void;
}

export function useVisualEdit({
  onFileUpdate,
  getFileContent,
  componentFileName,
  fallbackFileNames = ["src/App.tsx"],
}: UseVisualEditOptions): UseVisualEditResult {
  const [isVisualEditMode, setIsVisualEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Track the occurrence index for patching (which className instance to patch)
  const patchOptsRef = useRef<PatchOptions>({ occurrence: 1 });

  const enterEditMode = useCallback(() => {
    setIsVisualEditMode(true);
    setSelectedElement(null);
    setEditError(null);
  }, []);

  const exitEditMode = useCallback(() => {
    setIsVisualEditMode(false);
    setSelectedElement(null);
    setEditError(null);
  }, []);

  const handleElementSelect = useCallback((element: SelectedElement) => {
    setSelectedElement(element);
    setEditError(null);
    // Update patch options with element info
    patchOptsRef.current = {
      tagName: element.tagName,
      selector: element.selector,
      occurrence: 1,
    };
  }, []);

  const getCandidateFiles = useCallback((): Array<{ fileName: string; content: string }> => {
    const candidates: string[] = [];
    if (componentFileName) candidates.push(componentFileName);
    for (const f of fallbackFileNames) candidates.push(f);
    const unique = Array.from(new Set(candidates.filter(Boolean)));
    return unique
      .map((fileName) => {
        const content = getFileContent(fileName);
        return content === undefined ? null : { fileName, content };
      })
      .filter((x): x is { fileName: string; content: string } => Boolean(x));
  }, [componentFileName, fallbackFileNames, getFileContent]);

  const applyStyleEdit = useCallback((prop: string, value: string) => {
    try {
      const files = getCandidateFiles();
      if (files.length === 0) {
        setEditError("No files available to patch.");
        return;
      }
      for (const file of files) {
        const patched = patchComponentStyle(file.content, prop, value, patchOptsRef.current);
        if (patched !== file.content) {
          setEditError(null);
          onFileUpdate(file.fileName, patched);
          return;
        }
      }
      setEditError("Couldn't apply this style change (no matching target found in code).");
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to patch style.");
    }
  }, [getCandidateFiles, onFileUpdate]);

  const applyTextEdit = useCallback((newText: string) => {
    if (!selectedElement) {
      setEditError("No element selected.");
      return;
    }
    try {
      const files = getCandidateFiles();
      if (files.length === 0) {
        setEditError("No files available to patch.");
        return;
      }
      for (const file of files) {
        const patched = patchComponentText(
          file.content,
          selectedElement.tagName,
          newText,
          patchOptsRef.current
        );
        if (patched !== file.content) {
          setEditError(null);
          onFileUpdate(file.fileName, patched);
          return;
        }
        // Fallback: patch string literals (e.g. message: "..." in an object, or prop strings)
        const patchedLiteral = patchTextInStringLiterals(
          file.content,
          selectedElement.textContent,
          newText,
          patchOptsRef.current
        );
        if (patchedLiteral !== file.content) {
          setEditError(null);
          onFileUpdate(file.fileName, patchedLiteral);
          return;
        }
      }
      setEditError(
        selectedElement.tagName.toLowerCase() === "input"
          ? 'Couldn’t update text for this input. If you clicked inside an input, try selecting the input border (not the typed value), or use AI Edit.'
          : "Couldn't apply this text change (the text may be dynamic like {label}, nested, or lives in another file)."
      );
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to patch text.");
    }
  }, [getCandidateFiles, onFileUpdate, selectedElement]);

  const applyAIEditResult = useCallback((newCode: string) => {
    if (!componentFileName) {
      setEditError("No component file to update.");
      return;
    }
    try {
      const fileContent = getFileContent(componentFileName);
      if (fileContent === undefined) {
        setEditError("No component file to update.");
        return;
      }
      const patched = applyAIEdit(newCode);
      setEditError(null);
      onFileUpdate(componentFileName, patched);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to apply AI edit.");
    }
  }, [componentFileName, getFileContent, onFileUpdate]);

  const clearError = useCallback(() => setEditError(null), []);

  return {
    isVisualEditMode,
    selectedElement,
    isApplyingEdit,
    editError,
    enterEditMode,
    exitEditMode,
    handleElementSelect,
    applyStyleEdit,
    applyTextEdit,
    applyAIEditResult,
    clearError,
  };
}
