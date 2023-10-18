export async function GET(context) {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "",
      "Sitemap: " + context.site + "sitemap-index.xml",
    ].join("\n")
  );
}
