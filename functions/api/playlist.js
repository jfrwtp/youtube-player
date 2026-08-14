export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId required" }, { status: 400 });
  }

  if (!env.DB) {
    return Response.json({ error: "D1 binding (DB) not found" }, { status: 500 });
  }

  try {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT video_id as id, title, channel, thumbnail 
         FROM playlist WHERE user_id = ? 
         ORDER BY created_at DESC`
      )
        .bind(userId)
        .all();
      return Response.json(results || []);
    }

    if (request.method === "POST") {
      const body = await request.json();
      const { id, title, channel, thumbnail } = body;
      if (!id) return Response.json({ error: "video id required" }, { status: 400 });

      await env.DB.prepare(
        `INSERT OR IGNORE INTO playlist (user_id, video_id, title, channel, thumbnail)
         VALUES (?, ?, ?, ?, ?)`
      )
        .bind(userId, id, title || "", channel || "", thumbnail || "")
        .run();
      return Response.json({ success: true });
    }

    if (request.method === "DELETE") {
      const videoId = url.searchParams.get("videoId");
      if (!videoId) return Response.json({ error: "videoId required" }, { status: 400 });

      await env.DB.prepare(`DELETE FROM playlist WHERE user_id = ? AND video_id = ?`)
        .bind(userId, videoId)
        .run();
      return Response.json({ success: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
