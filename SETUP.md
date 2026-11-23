# Going live: RESEARCH DASHBOARD 360

This guide connects the website to a free Supabase database and publishes it free on GitHub Pages.
Everything uses **aliagard360@gmail.com**, the district account that is also the only Super Administrator.

Total time: about 30 minutes. Cost: free.

---

## Part 1: The district Gmail (you)

1. Create **aliagard360@gmail.com** at accounts.google.com/signup if it doesn't exist yet.
2. Turn on **2-Step Verification** (Google Account → Security). Supabase and GitHub both work with it.
3. Add a recovery email or phone that the district controls, so access survives staff changes.

## Part 2: GitHub (you, then Claude)

1. Go to **github.com/signup** and sign up with aliagard360@gmail.com. Username: `aliagard360-creator`.
2. Verify the email GitHub sends.
3. On this computer, sign the GitHub CLI in to that account (it opens the browser):
   ```
   gh auth login
   ```
   Choose **GitHub.com → HTTPS → Login with a web browser**.

When you say **go**, Claude creates the public repository `research-dashboard-360`, uploads the site,
and turns on GitHub Pages. The site address will be:

**https://aliagard360-creator.github.io/research-dashboard-360/**

## Part 3: Supabase (you)

1. Go to **supabase.com** → **Start your project** → **Continue with GitHub** (use the aliagard360 GitHub account).
2. **New project**
   - Name: `research-dashboard-360`
   - Database password: click **Generate**, then save it in a safe place (you rarely need it).
   - Region: **Southeast Asia (Singapore)**, the closest to Nueva Ecija.
   - Plan: **Free**.
3. When the project is ready, open **SQL Editor → New query**, paste the whole content of
   `supabase/schema.sql`, and click **Run**. You should see "Success. No rows returned".
4. Open **Authentication → URL Configuration**
   - Site URL: `https://aliagard360-creator.github.io/research-dashboard-360/`
   - Redirect URLs: add `https://aliagard360-creator.github.io/research-dashboard-360/` and `http://localhost:5360/`
5. Open **Authentication → Sign In / Providers → Email** and make sure **Confirm email** is ON.
6. Open **Project Settings → API** (or **Data API**) and copy:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key (a long text starting with `eyJ`)

   Send these two values to Claude. They are safe to publish; the database rules protect the data.
   **Never** share the `service_role` key or the database password.

## Part 4: Emails (recommended)

Supabase's built-in email sender only allows a few emails per hour, which is fine for testing but not
for a whole district registering. To send from the district Gmail instead (free, about 500 emails a day):

1. In the Google Account of aliagard360 → Security → **App passwords** → create one named "Supabase".
2. In Supabase → **Project Settings → Authentication → SMTP Settings** → enable custom SMTP:
   - Host `smtp.gmail.com`, Port `465`, Username `aliagard360@gmail.com`, Password: the app password
   - Sender email `aliagard360@gmail.com`, Sender name `RESEARCH DASHBOARD 360`

## Part 4B: Research update emails to teachers (only an admin's decision sends one)

When an administrator moves a teacher's research to a new stage, the teacher gets an email with the new
status, any feedback the admin released, and a button to open the study. Teachers, evaluators and visitors
cannot send these emails. The admin can untick **"Email ... about this update"** in the confirm box to skip one.
The admin's private "Reason / basis" is never emailed.

You do this once (about 10 minutes). Use the same Gmail **app password** from Part 4.

1. **Run the email SQL.** Supabase → **SQL Editor** → New query → paste all of
   `supabase/email-updates.sql` → **Run**. It should say *Success*.
2. **Create the sender function.** Supabase → **Edge Functions** → **Deploy a new function** →
   **Via Editor**. Name it exactly `send-emails`. Delete the sample code, paste all of
   `supabase/functions/send-emails/index.ts`, then click **Deploy function**.
3. **Give it the Gmail login.** Supabase → **Edge Functions** → **Secrets** → add two secrets:
   - `GMAIL_USER` = `aliagard360@gmail.com`
   - `GMAIL_APP_PASSWORD` = the 16-letter app password (no spaces)
4. **Test it.** Sign in as an admin, open a test study by a test teacher, move it to the next stage
   with "Email ..." ticked. The teacher's inbox should get the email within a minute (check Spam the
   first time and mark it "Not spam").

If an email can't be sent right away, it waits and is retried every hour (GitHub workflow
"Send waiting emails") up to 5 times. Admins can see each email and any error in Supabase →
**Table Editor → email_outbox**. Gmail allows about 500 emails a day, which is plenty.

## Part 5: First sign-in (you)

1. Open the website → **First-time setup**. The email is fixed to aliagard360@gmail.com.
2. Enter a name and a strong password → **Create Super Administrator**.
3. Open the confirmation email in the aliagard360 inbox, then sign in on **Administrator sign in**.
4. Invite your District Research Coordinator: **User and Role Management → Invite someone → Role: Research Administrator**.
   They register on the website with that same email and get administrator access immediately.

Only the Super Administrator can invite administrators. Administrators can invite evaluators and approve teachers.

## Keeping it running

- **Free project pausing**: Supabase pauses free projects after about a week with no visits. The repository
  includes a small GitHub Action (`.github/workflows/keepalive.yml`) that visits the database every 3 days.
  Claude adds the two values from Part 3 as repository secrets when publishing.
- **Backups**: Supabase's free plan has no automatic backups. Once a month, open Supabase → **Table Editor**,
  and export the `profiles`, `projects` and `schools` tables to CSV. Keep them on a district computer,
  never in GitHub.
- **Updates**: changes Claude makes are published by pushing to GitHub; the site updates within a minute.

## What each person needs

| Who | Needs |
|---|---|
| Super Administrator | aliagard360@gmail.com and its password |
| Research Administrator | An invitation, then registers with that email |
| Evaluator | An invitation from an administrator |
| Teacher | Registers with their DepEd email, confirms it, waits for approval |
