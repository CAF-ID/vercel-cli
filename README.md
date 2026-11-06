# VTX Web 0.2

Browser-based virtual shell and file manager for Vercel. Designed for a single private workspace.

## What this build does

- Next.js web UI with xterm.js terminal.
- Private Vercel Blob-backed virtual workspace under `/workspace`.
- Browser file explorer, upload, text editor, save, delete, and download.
- Linux-like virtual commands: `help`, `pwd`, `ls`, `cd`, `mkdir`, `touch`, `cat`, `write`, `rm`, `cp`, `mv`, `tree`, `whoami`, `uname`, `date`, `clear`.
- `node -e` runs JavaScript in an opaque-origin browser iframe (not a Node.js process).
- `python -c` runs Python in the browser using Pyodide WebAssembly.

## Important architecture limitations

This is a **virtual shell**, not a Linux VM or SSH server. Vercel Functions have a read-only deployment filesystem except temporary `/tmp`; function instances are ephemeral. Blob is object storage, not a mounted POSIX filesystem.

The `node` command is JavaScript execution in an opaque-origin browser iframe, not a complete Node.js CLI. It has no Node APIs such as `require`, `process`, filesystem, npm, or child-process access. It is isolated from the parent page origin; it is intended for simple JavaScript snippets, not untrusted multi-tenant execution.

Python uses Pyodide in the browser. It is CPython compiled to WebAssembly, not the Vercel Python server runtime. It does not have arbitrary host filesystem, shell, or native package access. Browser runtime downloads Pyodide from jsDelivr on first Python command.

The current file listing is capped at 1,000 blobs. Text editor and API writes are capped at 1 MB. Upload API is capped at 4 MB. Binary file editing is not supported; use upload/download for binary files. File download is streamed through an authenticated route.

## Deploy

1. Create a GitHub repository and upload this project.
2. Import the repository into Vercel.
3. In Vercel Storage, create a **Private Blob** store and connect it to this project.
4. Add environment variables:
   - `VTX_PASSWORD`: a long, unique password.
   - `VTX_SESSION_SECRET`: random secret, at least 32 characters.
   - `BLOB_READ_WRITE_TOKEN`: added automatically when the Blob store is connected.
5. Redeploy.
6. Open the deployment URL and sign in.

Generate a session secret locally:

```bash
openssl rand -base64 32
```

## Local development

```bash
npm install
cp .env.example .env.local
# Fill in VTX_PASSWORD, VTX_SESSION_SECRET and BLOB_READ_WRITE_TOKEN
npm run dev
```

## Example commands

```sh
help
pwd
ls
mkdir demo
cd demo
touch hello.txt
write hello.txt "Hello from VTX"
cat hello.txt
node -e "console.log(1 + 2)"
python -c "print('hello from python')"
```

## Security notes

- Use a Private Blob store, never a public store for workspace files.
- Do not commit `.env.local` or any Blob token.
- Use a unique strong password.
- Do not deploy this as a public arbitrary-code execution service.
- For multi-user support, add per-user identity, per-user Blob prefixes, CSRF/origin protection, rate limiting, audit logging, and an isolated execution service.
- For full Node.js with npm, native modules, subprocesses, persistent processes, SSH, or a real Linux filesystem, Vercel + Blob alone is insufficient. A separate sandbox/compute provider is required.
