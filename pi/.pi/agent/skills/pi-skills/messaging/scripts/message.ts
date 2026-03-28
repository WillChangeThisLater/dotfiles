#!/menubar/paul/.bun/bin/bun
import { $ } from "bun";
import { parseArgs } from "util";
 
async function listPanes(outside_window: boolean = false): Record<string, string> {

  const args = ["list-panes"];
  if (outside_window) {
    args.push("-a");
  }
  args.push("-F");
  args.push("#{session_name}:#{window_index}.#{pane_index} #{pane_title}");

  const rawOutput = await $`tmux ${args}`.text();

  const panes: Record<string, string> = {};

  rawOutput
    .trim()
    .split("\n")
    .forEach((line) => {
      // Split by the first space: [0:0.0, barack]
      const [coords, title] = line.split(" ");
      if (title) {
        if (title in panes) {
          console.error(`Duplicate pane: ${title}`);
          panes[title] = undefined;
        } else {
          panes[title] = coords;
        }
      }
    });

  return panes;
}

async function getName(): string {
  const currentPane = process.env.TMUX_PANE;
  let name: string = "";
  if (currentPane) {
    name = await $`tmux display-message -t ${currentPane} -p '#T'`.text();
  } else {
    name = await $`tmux display-message -p '#T'`.text();
  }

  if (name.trim() === "paul-MS-7E16") {
    console.error(`using system name: ${name}. this is not a valid name for messaging commands`);
    process.exit(1);
  }

  return name
}

async function namePane(name: string, all: boolean = false) {
  const panes = await listPanes(all ?? false);
  if (panes[name] !== undefined) {
    console.error(`error: pane named ${name} already exists!`);
    return;
  }

  const currentPane = process.env.TMUX_PANE;
  if (currentPane) {
    await $`tmux select-pane -t ${currentPane} -T ${name}`;
  } else {
    await $`tmux select-pane -T ${name}`;
  }
}

// assumes we are messaging something running pi-agent
async function sendMessage(name: string, keys: string, interrupt: boolean = false, outside_window: boolean = false, anon: boolean = false) {

  if (keys === undefined) {
    console.error(`no keys found`);
    process.exit(1);
  }


  if (!anon) {
    const senderName = await getName();
    keys = `from: ${senderName} ${keys}`;
  }
  const panes = await listPanes(outside_window ?? false);
  if (panes[name] === undefined) {
    console.error(`could not find pane ${name}`);
    return 
  }

  const paneId = panes[name];

  if (interrupt) {
    // interrupt whatever is running, then send the payload once
    await $`tmux send-keys -t ${paneId} Escape`;
    await Bun.sleep(25);
  }

  const cmd = `tmux send-keys -t ${paneId} ${keys} Enter`;
  console.log(cmd);
  await $`tmux send-keys -t ${paneId} ${keys} Enter`;
}

async function sendMessages(names: string, keys: string, interrupt: boolean = false, outside_window: boolean = false, anon: boolean = false) {
  if (keys === undefined) {
    console.error(`no keys found`);
    process.exit(1);
  }
  const nameArray = names.split(",");
  for (const name of nameArray) {
    await sendMessage(name, keys, interrupt ?? false, outside_window ?? false, anon ?? false);
  }
}

async function help() {
    console.log(`Usage:
  ./message.ts list-panes [--outside_window]
  ./message.ts message <name1,name2> "message" [--outside_window] [--interrupt] [--anon]
  ./message.ts name-pane <name>
  ./message.ts get-name

Examples:
  ./message.ts list-panes --outside_window
  ./message.ts message erik "heya"
  ./message.ts message paul,lauren "updates deployed"
  ./message.ts name-pane "michael"
    `);
     process.exit(1);
}

async function main() {
  const { values, positionals} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      outside_window: { type: "boolean", short: "o" },
      interrupt: { type: "boolean", short: "i" },
      anon: { type: "boolean", short: "a" },
    },
    allowPositionals: true,
    strict: false
  });

  let name;

  const [command, ...args] = positionals;
  switch (command) { 
    case "name-pane":
      name = args[0];
      await namePane(name)
      break;
    case "get-name":
      name = await getName(name)
      console.log(name)
      break;
    case "list-panes":
      const panes = await listPanes(values?.outside_window ?? false);
      console.log(panes);
      break;
    case "message":
      const names = args[0];
      const keys = args[1]
      await sendMessages(names, keys, values?.interrupt ?? false, values?.outside_window ?? false, values?.anon ?? false);
      break;
    case "help":
      help();
    default:
      console.error(`command ${command} not found`);
      help();
  }

  process.exit(0);
}


main()
