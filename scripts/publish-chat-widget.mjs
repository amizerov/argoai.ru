import { access, cp, mkdir } from "node:fs/promises";

const source = new URL("../chat-popup-widget/dist/", import.meta.url);
const destination = new URL("../public/chat-popup-widget/dist/", import.meta.url);

try {
  await access(new URL("chat-popup.iife.js", source));
} catch (cause) {
  if (cause.code !== "ENOENT") throw cause;

  try {
    await access(new URL("chat-popup.iife.js", destination));
    console.log("Using the bundled chat widget in public/chat-popup-widget/dist/.");
    process.exit(0);
  } catch (destinationError) {
    if (destinationError.code !== "ENOENT") throw destinationError;
  }

  throw new Error(
    "Missing chat widget bundle. Copy the widget's complete dist directory to public/chat-popup-widget/dist/ or build it in chat-popup-widget/dist/.",
    { cause },
  );
}

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });
console.log("Chat widget published to /chat-popup-widget/dist/chat-popup.iife.js");
