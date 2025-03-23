/** @jsx jsr:@hono/hono@4.7.5/jsx */
/** @jsxImportSource jsr:@hono/hono@4.7.5/jsx */

import { parseArgs } from "jsr:@std/cli/parse-args";
import { Hono } from "jsr:@hono/hono@4.7.5";
import { type FC } from "jsr:@hono/hono@4.7.5/jsx";
import { logger } from "jsr:@hono/hono@4.7.5/logger";
import * as v from "jsr:@valibot/valibot@1.0.0";
import { vValidator } from "./valibot-validator.ts";

const args = parseArgs(Deno.args);

const PORT = parseInt(args.port, 10) || 8000;
const kv = await Deno.openKv(args.db ?? "spb.sqlite");
const app = new Hono();

app.use("*", logger());

const Layout: FC = (props) => {
  return (
    <html>
      <head>
        <link rel="icon" href="data:,"></link>
        <title>SPB</title>
        <style>
          {`
            button[type=submit] {
              background-color: var(--tailwind-color-brand,#0096fa);
            }
          `}
        </style>
        <link
          rel="stylesheet"
          href="https://fsubal.github.io/charcoal-classless/index.min.css"
        />
      </head>
      <body>
        <header>
          <h1>Simple Private Bookmarks</h1>
        </header>
        <main>{props.children}</main>
      </body>
    </html>
  );
};

app.get("/", async (c) => {
  const bookmarks = await Array.fromAsync(
    kv.list<DB>({ prefix: ["bookmark:"] })
  );

  return c.html(
    <Layout>
      <section>
        <form action="/create" method="post">
          <label id="form-id">名前(optional)</label>
          <input for="form-id" name="title" type="text" />
          <label id="form-url">url</label>
          <input for="form-url" name="url" type="text" />
          <footer>
            <button type="submit">保存する</button>
          </footer>
        </form>
      </section>

      <section>
        <table>
          <thead>
            <tr>
              <td>名前</td>
              <td>URL</td>
              <td style={{ "white-space": "nowrap" }}>削除ボタン</td>
            </tr>
          </thead>
          <tbody>
            {bookmarks.map(({ key, value }) => {
              const [_prefix, id] = key;

              return (
                <tr>
                  <td>{value.title}</td>
                  <td>
                    <a href={value.url}>{value.url}</a>
                  </td>
                  <td>
                    <a href={`/delete/${id.toString()}`}>削除する</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </Layout>
  );
});

// タイトルのみか、URLのみか、タイトル+URLを許容する
const createSchema = v.union([
  // タイトルのみ
  v.object({
    title: v.pipe(v.string(), v.nonEmpty()),
    url: v.pipe(v.string(), v.empty()),
  }),

  // URLのみか、タイトル+URLを許容する
  v.object({
    title: v.string(),
    url: v.pipe(v.string(), v.url()),
  }),
]);

const dbSchema = createSchema;
type DB = v.InferOutput<typeof dbSchema>;

app.post("/create", vValidator("form", createSchema), async (c) => {
  const data = c.req.valid("form");
  console.log({ data });
  const id = crypto.randomUUID();
  await kv.set(["bookmark:", id], data);
  return c.redirect("/");
});

app.get("/delete/:id", async (c) => {
  const id = c.req.param("id");
  await kv.delete(["bookmark:", id]);
  return c.redirect("/");
});

Deno.serve({ port: PORT }, app.fetch);
