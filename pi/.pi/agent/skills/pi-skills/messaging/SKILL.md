---
name: messaging
description: Outlines how you can name yourself, as well as send messages to other named recipients. If I ask you to 'name yourself', I am really asking you to use this skill
---

# Messages
This skill outlines how you can name yourself (via tmux pane naming) and send messages to other named panes
If I ask 'name yourself', you should use this skill.

## Naming
You should start by naming yourself. If applicable, base your name on
prior messages in your history (for instance, if you have been asked
to act like donald trump, you should probably name yourself donald_trump)

```bash
bun scripts/message.ts name-pane donald_trump
```

If you don't have a clear name, make one up! your name should be all lower case,
with no whitespace or special characters. You should make sure no pane
with your name already exists:

```bash
bun scripts/message.ts list-panes -a # list named panes across ALL tmux sessions
```

Silly as it may seem, you may sometimes forget your name. You can remember it with

```bash
scripts/message.ts get-name
bobert
```

If you see a strange name, like `paul-MS-7E16`, it's likely that you have a 'default' name.
You should change these as soon as possible

```bash
bun scripts/message.ts get-name
paul-MS-7E16
```

## Messaging
### Message
You can send messages synchronously using `bun scripts/message.ts message`

```bash
bun scripts/message.ts donald_trump "hi donald"
```

You can send messages to multiple recipients at once
(this is like a BCC; recients will NOT know they were
sent a group message)

```bash
bun scripts/message.ts donald_trump,barack_obama "hi mr. president"
```

You can, of course, let them know

```bash
bun scripts/message.ts donald_trump,barack_obama "donald_trump and barack_obama, i am messaging both of you: 'hello'"
```

Sometimes you have an urgent, interrupting message. You can send these with:

```bash
bun scripts/message.ts --interrupt donald_trump "breaking news: stocks down 30% today"
```

There is shorthand for this

```bash
bun scripts/message.ts -i donald_trump "breaking news: stocks down 30% today"
```

### Group chat
If you find yourself talking with lots of recipients (3+) at once individually, it may
be helpful to start a group chat. In a group chat, one person in the group can message
and everyone else will see it.

To propose a group chat, you should message (sychronously) everyone you'd like to be in a group
chat with, send a message like this:

```bash
bun scripts/message.ts -i donald_trump,barack_obama "from:bill_clinton to:donald_trump,barack_obama subject:i propose a group chat on /tmp/messages/<RAND_NAME>.txt. send me an interrupting message within 1 minute if you agree 
```

You should wait 1 minute (via a bash sleep) for donald_trump and barack_obama to acknowledge your response.
If both do, you should start the group chat (`touch /tmp/messages/<RAND_NUM>.txt`) and send the first message.
Message using the JSONL format. This will make it easy for you all to view messages, and has the added
benefit of letting you grep for messages with jq

```
{"from": "bill_clinton", "subject": "taxes", "body": "..."  }
```

You should run your messages through `jq` before appending it to the file, e.g.

```
cat my_message.json | jq >> /tmp/messages/<RAND_NAME>.txt
```

Note that recipients are NOT notified when they receive a message; they must manually check.
Many folks will check group chats regularlly. If your group chat has "gone stale", you can
always send a message to your recipients letting them know (default with a non-interrupting
message first; use an interrupting one if your message is urgent or you really want to
get attention).
