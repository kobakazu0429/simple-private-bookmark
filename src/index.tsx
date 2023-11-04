/** @jsx jsx */
/** @jsxFrag Fragment */

import { Hono } from "hono";
import { jsx, type FC } from "hono/jsx";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const PORT = parseInt(Deno.env.get("PORT")!, 10) || 8000;

const kv = await Deno.openKv("spb.sqlite");
const app = new Hono();

app.use("*", logger());

const fromAsync = async (items: AsyncIterator<any>) => {
  const result = [];
  for await (const item of items) {
    result.push({ ...item, value: JSON.parse(item.value) });
  }
  return result;
};

const Layout: FC = (props) => {
  return (
    <html>
      <head>
        <link rel="icon" href="data:,"></link>
        <title>SPB</title>
      </head>
      <body>{props.children}</body>
    </html>
  );
};

app.get("/", async (c) => {
  const bookmarks = await fromAsync(kv.list({ prefix: ["bookmark:"] }));

  return c.html(
    <Layout>
      <h1>Simple Private Bookmarks</h1>

      <form action="/create" method="post">
        <label>url</label>
        <input name="url" />
        <input type="submit" value="submit" />
      </form>

      <ul>
        {bookmarks.map(({ value }) => {
          console.log(value);
          const { url } = value;
          return (
            <li>
              <a href={url}>{url}</a>
            </li>
          );
        })}
      </ul>
    </Layout>
  );
});

const createSchema = z.object({
  // name: z.string().regex(/^[a-z]+$/g),
  // title: z.string(),
  url: z.string().url(),
});

app.post("/create", zValidator("form", createSchema), async (c) => {
  const data = c.req.valid("form");
  console.log({ data });
  const id = crypto.randomUUID();
  await kv.set(["bookmark:", id], JSON.stringify(data));
  return c.redirect("/");
});

Deno.serve({ port: PORT }, app.fetch);
