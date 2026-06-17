# aictrl

Local-first orchestration for multiple AI CLI coding sessions.

`aictrl` does not replace Codex CLI, Claude Code, Gemini CLI, or other terminal AI clients. It starts and observes those real commands from a local daemon so a developer can supervise multiple sessions from one browser console.

## MVP

```bash
npm test
node src/cli.js open --port 4317
```

Then open the printed `http://127.0.0.1:<port>` URL.
