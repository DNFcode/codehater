import rss, { type RSSFeedItem } from "@astrojs/rss";
import { getCollection } from "astro:content";
import { TITLE, DESCRIPTION } from "./siteInfo";
import type { APIRoute } from "astro";
import { getImage } from "astro:assets";

export const GET: APIRoute = async (context) => {
  const posts = await getCollection("blog");

  const rssFeedItemsPromises = posts.map(async (post) => {
    const image = await getImage({
      src: post.data.socialImage,
      format: "jpeg",
    });

    const rssItem: RSSFeedItem = {
      ...post.data,
      link: `/articles/${post.slug}/`,
      customData: `<media:content
        type="image/jpeg"
        width="${post.data.socialImage.width}"
        height="${post.data.socialImage.height}"
        medium="image"
        url="${new URL(image.src, context.request.url)}" />
    `,
    };

    return rssItem;
  });

  const rssFeedItems = await Promise.all(rssFeedItemsPromises);

  return rss({
    customData: `<atom:link href="${new URL(
      "/rss.xml",
      context.request.url
    )}" rel="self" type="application/rss+xml" />`,
    xmlns: {
      media: "http://search.yahoo.com/mrss/",
      atom: "http://www.w3.org/2005/Atom",
    },
    title: TITLE,
    description: DESCRIPTION,
    site: context.site!,
    items: rssFeedItems,
  });
};
