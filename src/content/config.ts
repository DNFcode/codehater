import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      // Transform string to Date object
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date(),
      heroImage: image(),
      socialImage: image(),
      imageAlt: z.string(),
      tags: z.array(z.string()),
    }),
});

export const collections = { blog };
