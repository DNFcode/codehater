import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { TITLE, DESCRIPTION } from "./siteInfo";

export async function GET(context) {
  const posts = await getCollection("blog");
  return rss({
    title: TITLE,
    description: DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      ...post.data,
      link: `/blog/${post.slug}/`,
    })),
  });
}
