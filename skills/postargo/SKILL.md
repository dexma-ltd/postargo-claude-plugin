---
name: postargo
description: Use when the customer wants to publish or schedule a social media post with PostArgo, upload photos or videos for one, see their connected social accounts, or see, cancel or retry the posts in their queue.
---

# PostArgo

PostArgo publishes and schedules the customer's social media posts. This plugin connects Claude to their PostArgo account through the server at https://mcp.postargo.ai/mcp.

Where you work decides what you use:

- **In a chat app** the tools draw screens for the customer. Use the tools: "Connect", "Draft a post" and "Publish, and the queue" below.
- **In a terminal on the customer's own machine**, where you run commands, no screen is drawn. Use "Scripts" below, or "API" if you write your own code. There you work with the customer's own API key. An API key is created in the PostArgo web app at https://app.postargo.ai, under Profile, "API & MCP". It belongs to one workspace and acts with its owner's permissions there. It is never pasted into the chat.

## Connect

PostArgo is connected once, in the chat app's own connection settings for this plugin: the app opens the PostArgo sign-in page, and signing in and approving there completes it. No key is pasted into the chat. Social accounts are connected in the PostArgo web app, at https://app.postargo.ai.

If a tool answers that sign-in is needed, ask the customer to connect PostArgo first.

In Claude and Cowork the connection is on the plugin's Connectors tab. In Claude Code, `/mcp` shows it.

## Draft a post

1. `show_accounts` lists the connected accounts and, for each network, the limits of a post and the settings it takes. Call it before `draft_post`, which takes the accounts' ids and only the settings listed there.
2. For photos or videos, `request_upload` shows an Upload button. Its link works for 30 minutes. When the customer has uploaded, call `request_upload` again with the link's id: it lists the files. `draft_post` takes their ids as `media` and the link's id as `upload`.
3. `draft_post` checks the draft and shows its preview. The time is `now`, or a time with its time zone offset: ask the customer for their time zone if you do not know it. If a network needs a choice, the answer lists the choices: ask the customer, then call `draft_post` again.

## Publish, and the queue

`show_posts` shows the queue: upcoming posts, posts that need attention (failed, or to be checked) and recently published ones.

Only the customer publishes or changes a post, with the buttons of the screens:

- Confirm in the preview publishes or schedules the draft. `draft_post` itself publishes nothing.
- In the queue: Cancel for a scheduled post, Retry for a failed one, and "It went out" or "It did not" for a post that needs a check.

You cannot do any of these yourself with the tools. To change a scheduled post, the customer cancels it and you draft it again.

Where no screen is drawn there is no button to press: the tools show the accounts, the check of a draft and the queue, and publish nothing. In an app that has neither screens nor a terminal, say that nothing can be published, cancelled or retried from it.

## Scripts

The plugin carries the PostArgo command-line client in its `scripts` folder. Nothing is installed: it runs with Node.js 20 or newer from the plugin's own folder, with a command after it:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" <command>
```

Where the client's own messages say `postargo <command>`, they mean this line with that command. `--json` after a command answers in JSON, `--help` shows its options. Use only the commands named here: the client lists more, and PostArgo does not offer them.

### Check access first

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" whoami
```

It answers with the customer, their workspace and what their key may do: publishing needs `posts.write`, uploading `media.write`.

If it answers "Not logged in" or "Unauthorized", the customer signs in, once. Ask them to run this line in a separate terminal window, not in this chat:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" login --url https://app.postargo.ai
```

It asks for their API key and hides it while they type.

Never ask the customer for the key, never run `login` yourself, never open the file the client keeps the key in, and never set `POSTARGO_URL` or `POSTARGO_API_KEY`, which the client's own messages name: with another address set, a command sends the saved key there.

### Commands

- `accounts`: The connected accounts, each with its id, its network and its status. An account with the status `reconnect` or `disabled` cannot publish until the customer reconnects it in the web app.
- `platforms --connected`: For each connected network, the limits of a post and the settings it takes. A setting with a `*` is required.
- `platforms <network>`: Every setting of one network, with its choices.
- `accounts options <account> <setting>`: The choices of a setting that depends on the account.
- `media upload <files...>`: Uploads photos and videos and answers with their ids (`med_...`).
- `post`: Publishes or schedules a post. See "Publish a post" below.
- `posts --upcoming`: The scheduled posts, the next one first.
- `posts --status failed,needs_check`: The posts that need attention.
- `posts`: Every post, the newest first.
- `posts show <post>`: One post with its state, its publishing log and, if it failed, the error.
- `posts cancel <post>`: Cancels a scheduled post.
- `posts retry <post>`: Publishes a failed post again.
- `posts resolve <post> --published`: For a post in the state `needs_check`, which may or may not have gone out. Ask the customer to look at their profile first. This marks it as published; with `--retry` in place of `--published` it is published again, which doubles a post that did go out.

A list of posts stops at 50 rows without saying so, one row for each account of a post: `--limit <n>` shows more, up to 1000.

### Publish a post

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" post -a <account> --text "<text>" --now
```

- `-a` takes an account's id from `accounts`. Repeat it to publish to several accounts.
- The text is `--text "<text>"`, or `--text-file <file>` for a long text or one with several lines.
- `-m <file or media id>` adds a photo or a video. Repeat it for several. A file is uploaded first.
- The time is `--now`, or `--at "<time>"` to schedule: `"2026-12-01 09:00"`, `"tomorrow 9:00"`, `"in 2h"`. It is read as the time of the customer's machine.
- `--set <setting>=<value>` fills a setting of the network. A required setting that is missing is reported with the `--set` to add.
- `--dry-run` only checks the post against the rules of each network. A file given with `-m` is uploaded even then: upload it once with `media upload` and pass its id.

Publish only what the customer asked you to publish, to the accounts they named. Ask when the account, the text or the time is not clear, and use `--now` only when they asked to publish now. Cancel or retry only the posts they named.

The answer has the post's id. `posts show <post>` then tells how it went: `published`, or `failed` with the error. A post can stay `publishing` for a few minutes, while a network that did not answer is tried again.

## API

An agent that writes its own code calls the PostArgo API at `https://app.postargo.ai/api`, with the customer's own API key in the header `Authorization: Bearer <key>`. Requests and answers are JSON. An error answers with a 4xx or 5xx status and `{ "error": "<message>" }`.

Your code reads the key from where the customer keeps it, such as an environment variable they set: never ask for it and never print it.

- `GET /api/accounts` lists the connected accounts, `GET /api/providers` the limits and settings of each network.
- `POST /api/media` uploads one photo or video: the body is the file, `Content-Type` its type and `X-Filename` its name. The answer has its `id`.
- `POST /api/posts` publishes or schedules: `{ "scheduledAt": "now", "posts": [{ "accountId": "<account>", "content": "<text>", "media": ["<media id>"] }] }`. `scheduledAt` is `"now"` or a time in milliseconds since 1970. `POST /api/posts/validate` takes the same and only checks it.
- `GET /api/posts?status=scheduled` lists posts (also `failed`, `needs_check`, `published`), `GET /api/posts/<post>` shows one with its log. A list is the oldest first and stops at 500 rows: `&order=desc` gives the newest first, `&limit=<n>` up to 1000 rows.
- `POST /api/posts/<post>/cancel` cancels a scheduled post, `POST /api/posts/<post>/retry` publishes a failed one again, and `POST /api/posts/<post>/resolve` with `{ "published": true }` or `{ "published": false }` settles a post in the state `needs_check`.
