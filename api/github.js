export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }

    const event = req.headers["x-github-event"];

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      return res.status(200).json({ ok: false, error: "Missing webhook URL" });
    }

    let embed = {
      title: "GitHub Event",
      color: 0xe3aaff,
      description: "No data",
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

      const safeDiff = "```diff\n" + fileList + "\n```";

      embed = {
        title: repo,
        color: 0xe3aaff,
        description:
          `🚀 **Push Event**\n` +
          `🧾 ${commits.length || 1} commit(s)\n\n` +
          safeDiff,
        fields: [
          {
            name: "Commit",
            value: `\`${commitId}\` — ${commitMsg}`.slice(0, 1024),
            inline: false
          }
        ],
        footer: {
          text: `GitHub • ${payload?.pusher?.name || "unknown"}`
        },
        timestamp: new Date().toISOString()
      };
    }

    // =========================
    // 🔀 PULL REQUEST EVENT
    // =========================
    if (event === "pull_request") {
      const pr = payload?.pull_request || {};
      const repo = payload?.repository?.full_name || "repo";

      embed = {
        title: repo,
        color: 0xe3aaff,
        description:
          `🔀 **PR ${pr?.action || "update"}**\n` +
          `**${pr?.title || "No title"}**\n\n` +
          (pr?.html_url || ""),
        footer: {
          text: `PR • ${pr?.user?.login || "unknown"}`
        },
        timestamp: new Date().toISOString()
      };
    }

    // =========================
    // DISCORD SEND (100% SAFE)
    // =========================
    const safePayload = {
      embeds: [
        {
          ...embed,
          description:
            (embed.description || "No content").slice(0, 4096)
        }
      ]
    };

    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(safePayload)
    });

    // Discord can fail silently → still handle it safely
    if (!discordRes.ok) {
      const text = await discordRes.text();
      console.error("Discord error:", text);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook crash:", err);
    return res.status(200).json({ ok: false });
  }
}
