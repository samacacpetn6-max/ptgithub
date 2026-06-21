export const config = {
  api: {
    bodyParser: false
  }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }

    const event = req.headers["x-github-event"];
    const rawBody = await getRawBody(req);

    let payload = {};
    try { payload = JSON.parse(rawBody); } catch {}

    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    if (!DISCORD_WEBHOOK_URL) {
      return res.status(200).json({ ok: false, error: "Missing webhook" });
    }

    const color = 0xe3aaff;

    if (event === "push") {
      const repo = payload?.repository?.full_name || "unknown/repo";
      const commits = payload?.commits || [];
      const head = payload?.head_commit || commits.at(-1) || {};
      const sha = head?.id?.slice(0, 7) || "unknown";
      const msg = head?.message?.split("\n")[0] || "No message";

      const files = [
        ...(head?.added || []),
        ...(head?.modified || []),
        ...(head?.removed || [])
      ].slice(0, 15);

      const fileBlock = files.length > 0
        ? "```diff\n" + files.map(f => `! ${f}`).join("\n") + "\n```"
        : "```\nNo file changes\n```";

      const embed = {
        title: repo,
        color,
        description:
          `There has been ${commits.length || 1} commit to \`${repo}\`\n\n` +
          fileBlock,
        footer: {
          text: `${sha} - ${msg}`
        },
        timestamp: new Date().toISOString()
      };

      await sendDiscord(DISCORD_WEBHOOK_URL, embed);
      return res.status(200).json({ ok: true });
    }

    if (event === "pull_request") {
      const pr = payload?.pull_request || {};
      const repo = payload?.repository?.full_name || "unknown/repo";
      const sha = pr?.head?.sha?.slice(0, 7) || "unknown";

      const embed = {
        title: repo,
        color,
        description:
          `There has been 1 pull request to \`${repo}\`\n\n` +
          `\`\`\`\n${pr?.title || "No title"}\n\`\`\``,
        footer: {
          text: `${sha} - ${pr?.title || "No title"}`
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

async function sendDiscord(url, embed) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          ...embed,
          description: (embed.description || "").slice(0, 4096)
        }
      ]
    })
  });
}
