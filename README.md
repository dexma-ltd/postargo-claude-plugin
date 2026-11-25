# PostArgo

PostArgo publishes and schedules your social media posts from the chat. Connect your social accounts in the PostArgo web app. In the chat, upload photos and videos, draft a post and see its preview, then press Confirm to publish it now or at the time you chose. The queue shows your upcoming posts, the posts that need attention and the recently published ones: cancel a scheduled post, retry a failed one.

## Use it

Ask Claude to show your connected accounts, to draft a post or to show your queue. A draft opens a preview, and nothing is published until you press Confirm in it. In the queue you cancel a scheduled post or retry a failed one.

## Connect

PostArgo is connected once, in the chat app's own connection settings for this plugin: the app opens the PostArgo sign-in page, and signing in and approving there completes it. No key is pasted into the chat. Social accounts are connected in the PostArgo web app, at https://app.postargo.ai.

The plugin points Claude at the server https://mcp.postargo.ai/mcp.

## In Claude Code

Claude Code draws no screens, so it has no Confirm button. There Claude publishes with the scripts this plugin carries: the PostArgo command-line client, which runs with Node.js from the plugin's own folder. Nothing is installed. The client sends your posts, photos and videos to PostArgo at https://app.postargo.ai, and nowhere else.

The client works with your own API key. An API key is created in the PostArgo web app at https://app.postargo.ai, under Profile, "API & MCP". It belongs to one workspace and acts with its owner's permissions there. It is never pasted into the chat.
You type it once, hidden, in your own terminal: Claude gives you the line to run. The client keeps it in a settings file on your machine.

## Links

- Site: https://postargo.ai
- Support: hello@postargo.ai
- Privacy: https://postargo.ai/privacy/
- Terms: https://postargo.ai/terms/
