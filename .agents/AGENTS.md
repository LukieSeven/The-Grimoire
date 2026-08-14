# Project Rules

- **Git Push Remote:** Always use the `the-grimoire` remote (`https://github.com/LukieSeven/The-Grimoire`) for pushing changes. Never push to `origin` or any other remote.
- **Local Process Execution:** Never run local development servers, builds, test runners, or any local diagnostic commands (such as `npm run build` or `npm run dev`) unless explicitly and directly requested by the user.
- **Investigative Questions & Diagnostics:** When the user asks a question, requests an explanation, or asks to identify an issue, NEVER make code changes or attempt fixes automatically. Inspect the codebase, report the exact findings back to the user, and STOP to await explicit approval before touching any code.
- **No Hardcoded Tool Values:** NEVER hardcode fixed fallback numbers or values for attributes, stats, formula limits, or vitals that exist dynamically within the tool. Always evaluate and read the character's real dynamic data.
- **Strict Backwards Compatibility:** All versions of the tool must maintain complete backwards compatibility with offloaded `.json` and `.soul` export files for characters, database, archives, and all schemas. Import and migration routines must normalize legacy data into current formats without losing data or breaking.
