export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }

    const event = req.headers["x-github-event"];

    // 🔥 SAFE BODY PARSING (Vercel fix)
    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      throw new Error("Missing DISCORD_WEBHOOK_URL");
    }

    let embed = {
      title: "gitHub event",
      color: 0xe3aaff,
      description: "unknown event",
      timestamp: new Date().toISOString()
    };

    // =========================
    // 🚀 PUSH EVENT
    // =========================
    if (event === "push") {
      const repo = payload?.repository?.full_name || "unknown/repo";
      const commits = payload?.commits || [];
      const head = payload?.head_commit || {};

      const commitId = head?.id?.slice(0, 7) || "unknown";
      const commitMsg = head?.message?.split("\n")[0] || "No message";

      const files = [
        ...(head?.added || []),
        ...(head?.modified || []),
        ...(head?.removed || [])
      ].slice(0, 10);

      const fileList =
        files.length > 0
          ? files.map(f => `! ${f}`).join("\n")
          : "No file changes";

      embed = {
        title: repo,
        color: 0xe3aaff,
        description:
          `There has been **${commits.length || 1} commit(s)** to **${repo}**\n\n` +
          "```diff\n" +
          fileList +
          "\n```",
        fields: [
          {
            name: "Commit",
            value: `\`${commitId}\` - ${commitMsg}`,
            inline: false
          }
        ],
        footer: {
          text: `GitHub Push • ${payload?.pusher?.name || "unknown"}`
        },
        timestamp: new Date().toISOString()
      };
    }

    // =========================
    // 🔀 PULL REQUEST EVENT
    // =========================
    if (event === "pull_request") {
      const pr = payload?.pull_request;

      embed = {
        title: payload?.repository?.full_name || "repo",
        color: 0xe3aaff,
        description:
          `There has been a **PR ${pr?.action || "update"}**\n\n` +
          `**${pr?.title || "No title"}**\n` +
          `${pr?.html_url || ""}`,
        footer: {
          text: `PR • ${pr?.user?.login || "unknown"}`
        },
        timestamp: new Date().toISOString()
      };
    }

    // =========================
    // SEND TO DISCORD (SAFE)
    // =========================
    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!discordRes.ok) {
      const text = await discordRes.text();
      console.error("Discord error:", text);
    }

    // 🔥 ALWAYS SUCCESS FOR GITHUB (IMPORTANT)
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);

    // NEVER break GitHub webhook delivery
    return res.status(200).json({
      ok: false,
      error: err.message
    });
  }
}
