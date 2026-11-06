"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

type Entry = { pathname: string; size: number; uploadedAt: string; url: string };
const ROOT = "/workspace";

export default function Home() {
  const terminalHost = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [cwd, setCwd] = useState(ROOT);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState("");
  const [editorText, setEditorText] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshFiles() {
    const r = await fetch("/api/files");
    if (r.status === 401) { setLoggedIn(false); return; }
    if (r.ok) setEntries((await r.json()).files || []);
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (r.ok) { setLoggedIn(true); setPassword(""); }
    else alert("Password salah.");
  }

  async function readFile(path: string) {
    const r = await fetch("/api/file?path=" + encodeURIComponent(path));
    if (!r.ok) throw new Error(await r.text());
    return await r.text();
  }

  async function writeFile(path: string, content: string) {
    const r = await fetch("/api/file", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, content }) });
    if (!r.ok) throw new Error(await r.text());
  }

  async function removeFile(path: string) {
    const r = await fetch("/api/file?path=" + encodeURIComponent(path), { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
  }

  async function execute(line: string, terminal: Terminal) {
    const args = line.trim().split(/\s+/);
    const cmd = args.shift() || "";
    if (!cmd) return;
    const resolve = (p: string) => {
      if (p.startsWith("/")) return normalize(p);
      return normalize(cwd + "/" + p);
    };
    const print = (s = "") => terminal.writeln(s);
    try {
      switch (cmd) {
        case "help":
          print("VTX built-ins: help, pwd, ls, cd, mkdir, touch, cat, write, rm, cp, mv, tree, clear, whoami, uname, date, node, python");
          print("Node: node -v | node -e \"console.log('hello')\"  (browser JavaScript subset)");
          print("Python: python --version | python -c \"print('hello')\"  (Pyodide WASM)");
          print("File paths are virtual paths stored in private Vercel Blob.");
          break;
        case "pwd": print(cwd); break;
        case "whoami": print("vtx"); break;
        case "uname": print("VTX Virtual Linux 0.2 (serverless)"); break;
        case "date": print(new Date().toString()); break;
        case "clear": terminal.clear(); break;
        case "ls": {
          const prefix = args[0] ? resolve(args[0]) : cwd;
          const r = await fetch("/api/files?prefix=" + encodeURIComponent(prefix.replace(/\/?$/, "/")));
          if (!r.ok) throw new Error(await r.text());
          const data = await r.json();
          (data.files as Entry[]).forEach(f => print(f.pathname.slice(prefix.length)));
          if (!data.files.length) print("(empty)");
          break;
        }
        case "cd": {
          const next = args[0] ? resolve(args[0]) : ROOT;
          if (next !== ROOT && !next.startsWith(ROOT + "/")) throw new Error("Permission denied: workspace boundary");
          setCwd(next.replace(/\/$/, "") || ROOT);
          break;
        }
        case "mkdir": {
          if (!args[0]) throw new Error("usage: mkdir <directory>");
          const p = resolve(args[0]).replace(/\/$/, "") + "/.vtxdir";
          await writeFile(p, "");
          print("");
          break;
        }
        case "touch": {
          if (!args[0]) throw new Error("usage: touch <file>");
          await writeFile(resolve(args[0]), "");
          print("");
          break;
        }
        case "cat": {
          if (!args[0]) throw new Error("usage: cat <file>");
          print(await readFile(resolve(args[0])));
          break;
        }
        case "write": {
          const m = line.match(/^write\s+(\S+)\s+([\s\S]*)$/);
          if (!m) throw new Error('usage: write <file> "content"');
          await writeFile(resolve(m[1]), m[2].replace(/^["']|["']$/g, ""));
          print("");
          break;
        }
        case "rm": {
          if (!args[0]) throw new Error("usage: rm <file>");
          await removeFile(resolve(args[0]));
          print("");
          break;
        }
        case "cp":
        case "mv": {
          if (args.length < 2) throw new Error(`usage: ${cmd} <source> <destination>`);
          const content = await readFile(resolve(args[0]));
          await writeFile(resolve(args[1]), content);
          if (cmd === "mv") await removeFile(resolve(args[0]));
          print("");
          break;
        }
        case "tree": {
          const r = await fetch("/api/files");
          const data = await r.json();
          (data.files as Entry[]).filter(f => f.pathname.startsWith(ROOT + "/")).forEach(f => print(f.pathname.slice(ROOT.length + 1)));
          break;
        }
        case "node": {
          if (args[0] === "-v" || args[0] === "--version") { print("v22-compatible browser JavaScript mode"); break; }
          const code = line.replace(/^node\s+-e\s+/, "").replace(/^node\s+/, "");
          const output = await runJavaScript(code);
          output.forEach(print);
          break;
        }
        case "python": {
          if (args[0] === "--version" || args[0] === "-V") { print("Python 3.12 (Pyodide WebAssembly)"); break; }
          const code = line.replace(/^python\s+-c\s+/, "").replace(/^python\s+/, "").replace(/^["']|["']$/g, "");
          const result = await runPython(code);
          result.split("\n").forEach(print);
          break;
        }
        default: print(`${cmd}: command not found. Type 'help'.`);
      }
      await refreshFiles();
    } catch (e) {
      print(`vtx: ${e instanceof Error ? e.message : "command failed"}`);
    }
  }

  function normalize(path: string) {
    const stack: string[] = [];
    for (const part of path.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    return "/" + stack.join("/");
  }

  async function runJavaScript(code: string): Promise<string[]> {
    // Execute in an opaque-origin sandboxed iframe, not in the Vercel server process.
    return new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.sandbox.add("allow-scripts");
      frame.style.display = "none";
      const id = crypto.randomUUID();
      const timer = window.setTimeout(() => { frame.remove(); reject(new Error("JavaScript execution timed out (5s)")); }, 5000);
      const onMessage = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.data?.id !== id) return;
        window.clearTimeout(timer); window.removeEventListener("message", onMessage); frame.remove();
        if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.output || []);
      };
      window.addEventListener("message", onMessage);
      frame.srcdoc = `<script>
        addEventListener('message', async (e) => {
          if (e.source !== parent || e.data?.id !== ${JSON.stringify(id)} || typeof e.data.code !== 'string') return;
          const out = [];
          const c = { log:(...a)=>out.push(a.map(String).join(' ')), info:(...a)=>out.push(a.map(String).join(' ')), warn:(...a)=>out.push(a.map(String).join(' ')), error:(...a)=>out.push(a.map(String).join(' ')) };
          try { const result = (new Function('console', e.data.code))(c); if (result !== undefined) out.push(String(await result)); parent.postMessage({id:${JSON.stringify(id)},output:out}, '*'); }
          catch(err) { parent.postMessage({id:${JSON.stringify(id)},error:String(err)}, '*'); }
        });
      <\/script>`;
      // Send the source only after the opaque-origin iframe has loaded.
      frame.onload = () => frame.contentWindow?.postMessage({ id, code }, "*");
      document.body.appendChild(frame);
    });
  }

  async function runPython(code: string): Promise<string> {
    const w = window as typeof window & { loadPyodide?: (opts: object) => Promise<any>; pyodide?: any };
    if (!w.pyodide) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js";
        s.onload = () => resolve(); s.onerror = () => reject(new Error("Pyodide gagal dimuat"));
        document.head.appendChild(s);
      });
      w.pyodide = await w.loadPyodide!({});
    }
    const py = w.pyodide;
    py.runPython("import sys, io\n_vtx_out = io.StringIO()\nsys.stdout = _vtx_out");
    py.runPython(code);
    return py.runPython("_vtx_out.getvalue()") || "";
  }

  useEffect(() => {
    fetch("/api/files").then(r => setLoggedIn(r.status !== 401)).catch(() => setLoggedIn(false));
  }, []);

  useEffect(() => { if (loggedIn) refreshFiles(); }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn || !terminalHost.current) return;
    const term = new Terminal({ cursorBlink: true, fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 13, theme: { background: "#0b1220", foreground: "#dbeafe", cursor: "#60a5fa" } });
    const fit = new FitAddon(); term.loadAddon(fit); term.open(terminalHost.current); fit.fit();
    termRef.current = term;
    let buffer = "";
    const prompt = () => { term.write(`\r\n\x1b[32mvtx\x1b[0m:\x1b[34m${cwd}\x1b[0m$ `); };
    term.write("VTX Web Shell 0.2\r\nType 'help' to see available commands.\r\n");
    prompt();
    term.onData(async data => {
      if (data === "\r") {
        const line = buffer; buffer = "";
        await execute(line, term); prompt();
      } else if (data === "\u007f") {
        if (buffer.length) { buffer = buffer.slice(0, -1); term.write("\b \b"); }
      } else if (data === "\u0003") { buffer = ""; term.write("^C"); prompt(); }
      else if (data >= " ") { buffer += data; term.write(data); }
    });
    const onResize = () => fit.fit(); window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); term.dispose(); termRef.current = null; };
  }, [loggedIn, cwd]);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData(); form.append("file", file); form.append("path", cwd + "/" + file.name);
      const r = await fetch("/api/upload", { method: "POST", body: form });
      if (!r.ok) throw new Error(await r.text());
      await refreshFiles();
    } catch (e) { alert(e instanceof Error ? e.message : "Upload gagal"); }
    finally { setBusy(false); }
  }

  async function openEditor(path: string) {
    try { setSelected(path); setEditorText(await readFile(path)); setEditor(path); }
    catch (e) { alert(e instanceof Error ? e.message : "Gagal membuka file"); }
  }

  if (loggedIn === null) return <main className="center">Loading VTX…</main>;
  if (!loggedIn) return <main className="center"><form className="login" onSubmit={login}><div className="brand">VTX<span>WEB</span></div><p>Private workspace login</p><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Workspace password" autoFocus /><button>Sign in</button></form></main>;

  return <main className="app">
    <header><div className="brand">VTX<span>WEB</span></div><div className="status"><i/> PRIVATE WORKSPACE</div></header>
    <section className="workspace">
      <aside className="sidebar">
        <div className="sidehead"><b>EXPLORER</b><label className="upload">+ Upload<input type="file" onChange={e => upload(e.target.files?.[0])} /></label></div>
        <div className="path">{ROOT}</div>
        <div className="files">
          {entries.filter(f => f.pathname.startsWith(ROOT + "/")).map(f => <button key={f.pathname} className={selected === f.pathname ? "file selected" : "file"} onClick={() => openEditor(f.pathname)}><span>▤</span>{f.pathname.slice(ROOT.length + 1)}</button>)}
          {!entries.some(f => f.pathname.startsWith(ROOT + "/")) && <small>No files yet</small>}
        </div>
        {busy && <small>Uploading…</small>}
        <div className="sidefoot">Stored in Vercel Blob</div>
      </aside>
      <div className="mainpane">
        <div className="tabs"><span>TERMINAL</span>{editor && <button onClick={() => setEditor("")}>EDITOR: {editor.split("/").pop()} ×</button>}</div>
        {editor ? <div className="editor"><div className="editorbar"><span>{editor}</span><button onClick={async () => { await writeFile(editor, editorText); await refreshFiles(); alert("Saved"); }}>Save</button></div><textarea value={editorText} onChange={e => setEditorText(e.target.value)} spellCheck={false}/></div> : <div className="terminal" ref={terminalHost}/>}
      </div>
    </section>
    <footer><span>VTX 0.2</span><span>Virtual Linux · Node-compatible JS · Python WASM</span><span>Browser only</span></footer>
  </main>;
}
