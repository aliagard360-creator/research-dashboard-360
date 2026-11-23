// RESEARCH DASHBOARD 360: sends waiting research-update emails from the district Gmail account.
// Secrets (Supabase → Edge Functions → Secrets): GMAIL_USER, GMAIL_APP_PASSWORD.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Calling this function only sends emails an administrator's decision already queued; it never takes an address from the caller.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

const SITE = Deno.env.get("SITE_URL") ?? "https://aliagard360-creator.github.io/research-dashboard-360/";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// a short line for what the new status means to the teacher
const MEANING: Record<string, string> = {
  "Under Initial Screening": "The District Research Office has started checking your submission.",
  "Under Technical Review": "Your research is now being reviewed by an evaluator.",
  "Pending Ethics Review": "Your research is waiting for ethics review.",
  "Pending Approval": "Your research passed review and is waiting for approval.",
  "Returned for Revision": "Please revise your research. Open it on the website to see what to change, then resubmit.",
  "Approved": "Congratulations! Your research was approved.",
  "Rejected": "Your research was not approved. Open it on the website to see the reason.",
  "Ongoing Implementation": "Your research is now in implementation.",
  "For Final Evaluation": "Your research is ready for final evaluation.",
  "Completed": "Congratulations! Your research is completed.",
  "For Dissemination": "Your research is set for dissemination.",
  "Published": "Your research is now published in the district repository.",
  "Archived": "Your research record has been archived.",
};

function compose(row: { project_id: string | null; data: Record<string, string> }) {
  const d = row.data || {};
  const link = `${SITE}#/t/project/${encodeURIComponent(row.project_id ?? "")}`;
  const hello = d.name ? `Good day, ${d.name}!` : "Good day!";
  const what = MEANING[d.to] ?? "";
  const subject = `${d.research_id ?? "Your research"}: now "${d.to}"`;
  const text = [hello, "", `There is progress on your research "${d.title ?? ""}" (${d.research_id ?? ""}).`,
    `Status: ${d.from} → ${d.to}`, what, d.feedback ? `\nFeedback from the District Research Office:\n${d.feedback}` : "",
    "", `Open your research: ${link}`, "", "RESEARCH DASHBOARD 360 · Schools District of Aliaga",
    "This is an automatic message. Please don't reply; contact the District Research Office instead."].filter((x) => x !== null).join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#14301e">
  <div style="background:#1e4d2b;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#f3d27a">Research update</div>
    <div style="font-size:20px;font-weight:bold;margin-top:4px">RESEARCH DASHBOARD 360</div></div>
  <div style="border:1px solid #dfe6df;border-top:0;padding:22px;border-radius:0 0 14px 14px;background:#fff">
    <p style="margin:0 0 12px">${esc(hello)}</p>
    <p style="margin:0 0 14px">There is progress on your research:</p>
    <p style="margin:0 0 4px;font-weight:bold">${esc(d.title)}</p>
    <p style="margin:0 0 16px;font-family:monospace;color:#5b6b60">${esc(d.research_id)}</p>
    <p style="margin:0 0 6px"><span style="color:#5b6b60">${esc(d.from)}</span> &rarr; <b style="color:#1e4d2b">${esc(d.to)}</b></p>
    ${what ? `<p style="margin:0 0 16px">${esc(what)}</p>` : ""}
    ${d.feedback ? `<div style="background:#f4f1e8;border-left:4px solid #e8b931;padding:12px 14px;border-radius:8px;margin:0 0 16px"><b>Feedback from the District Research Office</b><br>${esc(d.feedback).replace(/\n/g, "<br>")}</div>` : ""}
    <p style="margin:18px 0"><a href="${esc(link)}" style="background:#1e4d2b;color:#fff;text-decoration:none;padding:11px 18px;border-radius:999px;display:inline-block">Open my research</a></p>
    <p style="margin:0;font-size:12px;color:#5b6b60">Schools District of Aliaga · This is an automatic message. Please don't reply; contact the District Research Office instead.</p>
  </div></div>`;
  return { subject, text, html };
}

Deno.serve(async () => {
  const user = Deno.env.get("GMAIL_USER"), pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) return reply({ error: "Gmail is not set up yet (GMAIL_USER / GMAIL_APP_PASSWORD secrets)." }, 500);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: rows, error } = await sb.rpc("claim_emails", { n: 20 });
  if (error) return reply({ error: error.message }, 500);
  if (!rows?.length) return reply({ sent: 0 });
  const tx = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      const m = compose(row);
      await tx.sendMail({ from: `"RESEARCH DASHBOARD 360" <${user}>`, to: row.to_email, subject: m.subject, text: m.text, html: m.html });
      const r = await sb.rpc("finish_email", { email_id: row.id, ok: true });
      if (r.error) console.error("could not mark email sent", row.id, r.error.message);
      sent++;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      console.error("email failed", row.id, msg);
      await sb.rpc("finish_email", { email_id: row.id, ok: false, err: msg });
      failed++;
    }
  }
  return reply({ sent, failed });
});
