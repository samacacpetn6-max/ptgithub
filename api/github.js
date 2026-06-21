export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }

    const event = req.headers["x-github-event"];

    // =========================
    // 🔥 RAW BODY PARSER (CRITICAL FIX)
    // =========================
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString("utf8");

    let payload = {};
    try {
      payload = JSON.parse(rawBody || "{}");
    } catch {
      payload = {};
    }

    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      return res.status(200).json({ ok: false, error: "Missing webhook" });
    }

    const color = 0xe3aaff;

    // =========================
    // 🚀 PUSH EVENT
    // =========================
    if (event === "push") {
      const repo =
        payload?.repository?.full_name ||
        payload?.repository?.name ||
        "unknown/repo";

      const commits = payload?.commits || [];

      const head =
        payload?.head_commit ||
        payload?.commits?.slice(-1)[0] ||
        {};

      const commitId =
        head?.id?.slice(0, 7) ||
        "unknown";

      const commitMsg =
        head?.message?.split("\n")[0] ||
        "No message";

      const files = [
        ...(head?.added || []),
        ...(head?.modified || []),
        ...(head?.removed || [])
      ].slice(0, 10);

      const fileBlock =
        files.length > 0
          ? "```diff\n" + files.map(f => `! ${f}`).join("\n") + "\n```"
          : "```No file changes```";

      const embed = {
        title: repo,
        color,
        description:
          `🚀 **Push Event**\n` +
          `🧾 ${commits.length || 1} commit(s)\n\n` +
          fileBlock,
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

      await sendDiscord(DISCORD_WEBHOOK_URL, embed);
      return res.status(200).json({ ok: true });
    }

    // =========================
    // 🔀 PULL REQUEST
    // =========================
    if (event === "pull_request") {
      const pr = payload?.pull_request || {};

      const repo =
        payload?.repository?.full_name ||
        "unknown/repo";

      const embed = {
        title: repo,
        color,
        description:
          `🔀 **PR ${pr?.action || "update"}**\n\n` +
          `**${pr?.title || "No title"}**\n` +
          (pr?.html_url || ""),
        footer: {
          text: `PR • ${pr?.user?.login || "unknown"}`
        },
        timestamp: new Date().toISOString()
      };

      await sendDiscord(DISCORD_WEBHOOK_URL, embed);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(200).json({ ok: true });
  }
}

// =========================
// 📤 DISCORD SENDER
// =========================
async function sendDiscord(url, embed) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          ...embed,
          description: (embed.description || "No content").slice(0, 4096)
        }
      ]
    })
  });
}
