/**
 * Eval harness entry point. Skeleton — see ARCHITECTURE.md §15.
 * Real prompts and scoring land in a dedicated ticket.
 */

async function main(): Promise<void> {
  console.log('eval harness skeleton — no prompts wired yet')
  console.log(JSON.stringify({pass: 0, fail: 0, total: 0}))
}

main().catch(err => {
  console.error('eval failed', err)
  process.exit(1)
})
