intersting... looks like the command hangs: paul-MS-7E16% cd /home/paul/repos/browser-cli && ./dist/index.js --port 9222 go https://www.youtube.com/results\?search_query\=sergeant+guy
[2026-03-18T00:57:15.901Z] [session] Connecting to Chrome: http://localhost:9222
[2026-03-18T00:57:15.901Z] [session] Connected to Chrome, created new tab
[2026-03-18T00:57:15.948Z] [go] Navigating to https://www.youtube.com/results?search_query=sergeant+guy (wait: domcontentloaded, timeout: 120000ms)
[go] Navigation completed in 1250ms
{"success":true,"tabId":"ED8130C7343B10FC7F0587BAC43E5247","url":"https://www.youtube.com/results?search_query=sergeant+guy","title":"","finalUrl":"https://www.youtube.com/results?search_query=sergeant+guy"}
[session] Detaching from Chrome (tab stays open)

we are saved a bit by the 2 minute timeout, but the command hanging in general is bad practice. how can we fix this? my bet here is that the initial timeout logic we are using spins up some kind of separate thread or process that does not get cancelled even once the browser finishes its job
