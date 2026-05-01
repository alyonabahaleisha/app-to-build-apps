---
description: "Launch the workflow observability dashboard in your browser"
user-invocable: true
---

# Open Dashboard

Launch the workflow observability dashboard.

## Instructions

1. Run `cd dashboard && npm install` if `node_modules` doesn't exist yet.
2. Start the server with `cd dashboard && npm run dev` (runs in background).
3. The dashboard will open automatically at `http://localhost:3077`.
4. Tell the user the dashboard is running and how to stop it (`Ctrl+C` in the terminal or kill the process).

The dashboard shows:
- **Overview**: All tickets with phase, verdict, retries, cost
- **Ticket Detail**: Deep dive into a single ticket -- phase timeline, verification pyramid, AC coverage, execution log, cost/budget
- **Traces**: Full event timeline with filtering by tool calls, phase transitions, spans, errors, metrics
- **Metrics**: North star (cost per success), success rate donut, failure by tier, phase durations, tool usage, ticket history

It auto-refreshes via WebSocket when any file in `.claude/state/` changes.
