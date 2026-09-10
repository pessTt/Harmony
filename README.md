#Harmony — Screen Sharing Program

A lightweight desktop app for you and your friends to share your screen (with system audio) and chat — no accounts, no camera, no microphone. Video/audio travel directly between computers (peer-to-peer via WebRTC); a small free signaling server just helps everyone find each other.

#Features
🖥️ Screen sharing at up to 60 FPS (auto-falls back to lower quality if your hardware can't keep up)
🔊 System audio capture — game/video sound travels along with the shared screen (only works when sharing the entire screen, not a specific window — this is a Windows/macOS limitation, not the app's)
🎚️ Per-friend volume control — a slider under each person's video, independent of everyone else's
🖱️ Fullscreen — double-click any video tile to expand it, double-click again to exit
💬 Text chat
🖼️ Profile photos — pick a picture on the login screen; it's small (128×128 JPEG) so it transmits fast
No mic, no camera, no accounts, no passwords — anyone who knows the room name can join, so pick a non-obvious room name (e.g. blue-panda-2024) rather than something guessable
Setup (one-time, for whoever hosts it)
Server: deploy the server/ folder (Node.js + Socket.io) to a free host like Render.com — Build Command npm install, Start Command npm start (or node server.js), Free plan. You'll get a URL like https://your-app.onrender.com.

Client: inside client/, run npm install then npm run dist:win (Windows) / npm run dist:mac (macOS, must be built on a Mac). Installers land in client/dist/.
Send the installer to your friends (Google Drive/WeTransfer — it's 100–200MB, too big for most chat apps).
#First run
The server URL is not required to be baked into the build. On first launch, open "Advanced settings" on the login screen and paste the real server URL — it's saved locally after that, so friends never need to touch config files or rebuild anything if the server URL ever changes.
Windows will show a "Windows protected your PC" SmartScreen warning on install (the app isn't code-signed — that costs money and isn't worth it for a personal project). Click More info → Run anyway. macOS will show a similar Gatekeeper warning; right-click the app → Open → confirm.

#How screen sharing works
Click "Compartilhar tela", pick a source. Choose "Entire Screen" (not an individual window) if you want your system audio to be transmitted too.
Only one person needs to share for it to work well; multiple simultaneous shares work but use more bandwidth for everyone.

If audio capture isn't available for the chosen source, the app automatically shares video-only and posts a chat message letting you know.
Known limitations

No authentication — room name is the only "password." No message history/persistence — everything is in-memory and disappears when the room empties.
No recording, no multiple channels/rooms per server instance (each room name is just an ephemeral group, created on first join, destroyed when empty).
Render's free tier "sleeps" after ~15 minutes of inactivity; the first person to join after a gap may wait ~20–50 seconds for the server to wake up. This is fine for a casual friend group; if you want zero wake-up delay, upgrade to Render's paid tier (~$7/mo) or self-host on a free-forever VPS like Oracle Cloud's Always Free tier.
System audio capture via desktop capture (not getDisplayMedia) is a Chromium/Electron feature that's most reliable on Windows when sharing the full screen; behavior on macOS may require extra OS-level permissions or isn't supported without a virtual audio driver.
