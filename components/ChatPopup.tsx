"use client";

import Script from "next/script";

declare global {
  interface Window {
    mountChatPopup?: () => void;
  }
}

export default function ChatPopup() {
  return (
    <Script
      src="/chat-popup-widget/dist/chat-popup.iife.js"
      strategy="afterInteractive"
      onReady={() => {
        if (document.getElementById("chat-popup-root")) return;

        if (typeof window.mountChatPopup === "function") {
          window.mountChatPopup();
        } else {
          console.error("Chat popup script did not expose window.mountChatPopup.");
        }
      }}
      onError={() => {
        console.error("Failed to load the chat popup script.");
      }}
    />
  );
}
