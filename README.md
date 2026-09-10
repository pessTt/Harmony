Harmony: Screen Sharing

A lightweight desktop app for you and your friends to share your screen (with system audio) and chat. No accounts, no camera, no microphone. Video and audio travel directly between computers (peer to peer via WebRTC); a small free signaling server just helps everyone find each other.

Features

Screen sharing at up to 1280x720, 60 FPS, with an automatic fallback to lower quality if your hardware can't keep up.

System audio capture: game or video sound travels along with the shared screen. This only works when sharing the entire screen, not a specific window, which is a Windows/macOS limitation, not the app's.

Per friend volume control: a slider under each person's video, independent of everyone else's.

Fullscreen: double click any video tile to expand it, double click again to exit.

Text chat.

Profile photos: pick a picture on the login screen. It's kept small (128x128 JPEG) so it transmits fast.

No mic, no camera, no accounts, no passwords. Anyone who knows the room name can join, so pick a non-obvious room name (something like blue-panda-2024) rather than something guessable.

Setup (one time, for whoever hosts it)

Server: deploy the server folder (Node.js and Socket.io) to a free host like Render.com, with Build Command "npm install" and Start Command "npm start" (or "node server.js"), on the Free plan. You'll get a URL like https://your-app.onrender.com.

Client: inside the client folder, run "npm install" then "npm run dist:win" for Windows or "npm run dist:mac" for macOS (must be built on a Mac). Installers land in client/dist.

Grab the installer from the Releases page.

First run

The server URL doesn't need to be baked into the build. On first launch, open "Advanced settings" on the login screen and paste the real server URL. It's saved locally after that, so friends never need to touch config files or rebuild anything if the server URL ever changes.

Windows will show a "Windows protected your PC" SmartScreen warning on install, since the app isn't code signed (that costs money and isn't worth it for a personal project). Click "More info", then "Run anyway." macOS will show a similar Gatekeeper warning; right click the app, choose Open, and confirm.

How screen sharing works

Click "Compartilhar tela" and pick a source. Choose "Entire Screen" (not an individual window) if you want your system audio to be transmitted too.

Only one person needs to share for it to work well. Multiple simultaneous shares work but use more bandwidth for everyone.

If audio capture isn't available for the chosen source, the app automatically shares video only and posts a chat message letting you know.

Known limitations

No authentication: the room name is the only "password." There's no message history or persistence; everything is in memory and disappears once the room empties.

No recording and no multiple channels or rooms per server instance. Each room name is just an ephemeral group, created on first join and destroyed when empty.

Render's free tier sleeps after about 15 minutes of inactivity. The first person to join after a gap may wait 20 to 50 seconds for the server to wake up. That's fine for a casual friend group; if you want zero wake up delay, upgrade to Render's paid tier (about $7/month) or self host on a free forever VPS like Oracle Cloud's Always Free tier.

System audio capture through desktop capture (not getDisplayMedia) is a Chromium/Electron feature that's most reliable on Windows when sharing the full screen. Behavior on macOS may require extra OS level permissions or isn't supported without a virtual audio driver.
