import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const sermons = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/sermons" }),
  schema: z.object({
    date: z.string(),
    preacher: z.string(),
    title: z.string(),
    summary: z.string(),
    audio: z.string(),
    cover: z.string().optional(),
    duration: z.number(),
    transcript: z.record(z.string(), z.string()).optional(),
    hidden: z.boolean().optional(),
    tts: z.record(z.string(), z.string()).optional(),
    tts_durations: z.record(z.string(), z.number()).optional(),
    translations: z
      .record(z.string(), z.object({ title: z.string(), summary: z.string() }))
      .optional(),
    bible_refs: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export const collections = { sermons };
