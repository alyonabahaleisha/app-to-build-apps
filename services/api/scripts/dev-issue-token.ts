/**
 * Dev-only: bypass email delivery to grab a fresh Supabase access token for
 * a given email, ready to feed into `appcreator://auth?token=<access>` via
 * `xcrun simctl openurl`.
 *
 * Usage: pnpm --filter @app-creator/api tsx scripts/dev-issue-token.ts <email>
 *
 * Two Supabase calls under the hood:
 *   1. admin.generateLink — issues a magiclink, returns `email_otp`
 *   2. (anon client) auth.verifyOtp({email, token: email_otp, type:'email'})
 *      — exchanges the OTP for a real session with access/refresh tokens
 *
 * Prints JUST the access_token to stdout so the caller can pipe it.
 * Logs context to stderr.
 */
import 'dotenv/config'

import {createClient} from '@supabase/supabase-js'

async function main() {
  const email = process.argv[2]
  if (!email) {
    process.stderr.write('usage: dev-issue-token.ts <email>\n')
    process.exit(2)
  }

  const url = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Anon key isn't in services/api/.env (it's mobile-side); but for verifyOtp
  // we can use the service role too — Supabase's REST endpoint accepts it.
  if (!url || !serviceRole) {
    process.stderr.write('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set\n')
    process.exit(2)
  }

  const admin = createClient(url, serviceRole, {
    auth: {persistSession: false, autoRefreshToken: false},
  })

  process.stderr.write(`> generating magic link for ${email}…\n`)
  const {data: linkData, error: linkErr} = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr) {
    process.stderr.write(`generateLink error: ${linkErr.message}\n`)
    process.exit(1)
  }
  const otp = linkData?.properties?.email_otp
  if (!otp) {
    process.stderr.write('no email_otp in response — Supabase API change?\n')
    process.stderr.write(JSON.stringify(linkData, null, 2) + '\n')
    process.exit(1)
  }
  process.stderr.write(`> got OTP, exchanging for session…\n`)

  const {data: sessionData, error: verifyErr} = await admin.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  })
  if (verifyErr) {
    process.stderr.write(`verifyOtp error: ${verifyErr.message}\n`)
    process.exit(1)
  }
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) {
    process.stderr.write('no access_token in session — Supabase API change?\n')
    process.stderr.write(JSON.stringify(sessionData, null, 2) + '\n')
    process.exit(1)
  }
  process.stderr.write(`> success. user.id=${sessionData.session?.user.id}\n`)
  // stdout = just the token, for piping
  process.stdout.write(accessToken)
}

main()
