import { useCallback, useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";

export type WebContainerStatus =
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "ready"
  | "error";

export interface UseWebContainerResult {
  previewUrl: string | null;
  status: WebContainerStatus;
  error: string | null;
  isSupported: boolean;
  bootAndMount: (tree: FileSystemTree) => Promise<void>;
  writeFiles: (files: Record<string, string>) => Promise<void>;
}

/**
 * Check if WebContainers are supported (Chromium with SharedArrayBuffer).
 */
function checkWebContainerSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof SharedArrayBuffer !== "undefined" && "serviceWorker" in navigator;
  } catch {
    return false;
  }
}

const isSupported = checkWebContainerSupport();

// WebContainer can only be booted once per page/origin.
// In dev, React/Vite HMR can remount hooks, so keep a true singleton here.
let sharedInstance: WebContainer | null = null;
let sharedBootPromise: Promise<WebContainer> | null = null;

export function useWebContainer(): UseWebContainerResult {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<WebContainerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const devServerProcessRef = useRef<{ kill: () => void } | null>(null);
  const lastWrittenRef = useRef<Record<string, string>>({});
  const lastDevLogsRef = useRef<string>("");
  const devProcessTokenRef = useRef(0);

  const bootAndMount = useCallback(async (tree: FileSystemTree) => {
    if (!isSupported) {
      setError("WebContainers require a Chromium-based browser (Chrome, Edge).");
      setStatus("error");
      return;
    }
    setError(null);
    setPreviewUrl(null);

    try {
      let instance = sharedInstance;
      if (!instance) {
        setStatus("booting");
        if (!sharedBootPromise) {
          sharedBootPromise = WebContainer.boot();
        }
        instance = await sharedBootPromise;
        sharedInstance = instance;
        sharedBootPromise = null;
        instance.on("error", (e: { message: string }) => {
          setError(e.message);
          setStatus("error");
        });
      }

      // Invalidate old dev-process exit handlers before killing.
      devProcessTokenRef.current += 1;
      devServerProcessRef.current?.kill?.();
      devServerProcessRef.current = null;

      setStatus("mounting");
      await instance.mount(tree);

      setStatus("installing");
      const installProcess = await instance.spawn("npm", ["install"]);
      const installExit = await installProcess.exit;
      if (installExit !== 0) {
        throw new Error(`npm install failed with code ${installExit}`);
      }

      setStatus("starting");
      const devProcess = await instance.spawn("npm", ["run", "dev"]);
      devServerProcessRef.current = devProcess;
      const myToken = devProcessTokenRef.current;

      devProcess.output.pipeTo(
        new WritableStream({
          write(chunk) {
            // Capture a small tail of logs for error reporting.
            const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk as Uint8Array);
            lastDevLogsRef.current = (lastDevLogsRef.current + text).slice(-8000);
          },
        })
      );

      // If the dev server dies, clear the preview URL so the iframe doesn't keep trying a dead port.
      devProcess.exit.then((code) => {
        // Ignore exits from older processes we intentionally killed during remount/restart.
        if (myToken !== devProcessTokenRef.current) return;
        if (code === 0) return;
        setPreviewUrl(null);
        setStatus("error");
        const tail = lastDevLogsRef.current.trim();
        setError(
          tail
            ? `Preview dev server exited (code ${code}).\n\n${tail}`
            : `Preview dev server exited (code ${code}).`
        );
      }).catch(() => {
        // ignore
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Dev server failed to start within 60s"));
        }, 60_000);
        const unsub = instance.on("server-ready", (_port: number, url: string) => {
          clearTimeout(timeout);
          setPreviewUrl(url);
          setStatus("ready");
          unsub();
          resolve();
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "WebContainer failed to start";
      setError(msg);
      setStatus("error");
    }
  }, []);

  const writeFiles = useCallback(async (files: Record<string, string>) => {
    const instance = sharedInstance;
    if (!instance) return;

    const last = lastWrittenRef.current;
    const toWrite: Record<string, string> = {};
    for (const [path, content] of Object.entries(files)) {
      if (last[path] !== content) {
        toWrite[path] = content;
      }
    }
    if (Object.keys(toWrite).length === 0) return;

    for (const [path, content] of Object.entries(toWrite)) {
      await instance.fs.writeFile(path, content);
      last[path] = content;
    }
  }, []);

  useEffect(() => {
    return () => {
      devServerProcessRef.current?.kill?.();
      // Keep sharedInstance alive to avoid "Only a single WebContainer instance" errors on HMR/remount.
    };
  }, []);

  return {
    previewUrl,
    status,
    error,
    isSupported,
    bootAndMount,
    writeFiles,
  };
}
