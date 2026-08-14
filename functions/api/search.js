export async function onRequest(context) {
  const url = new URL(context.request.url);
  const query = url.searchParams.get("q");
  const maxResults = url.searchParams.get("maxResults") || "12";

  if (!query) {
    return Response.json({ error: "Query required" }, { status: 400 });
  }

  const apiKey = context.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const res = await fetch(ytUrl);
    const data = await res.json();
    return Response.json(data, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
