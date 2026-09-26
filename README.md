This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Chat popup

The root layout includes `components/ChatPopup.tsx`, which loads
`/chat-popup-widget/dist/chat-popup.iife.js` from the local `public` directory and calls
`window.mountChatPopup()` when the script is ready, with a guard against duplicate
mounts. The widget's own styles fix its launcher to the bottom-right corner with
a 20 px inset. A prebuilt bundle is included in `public/chat-popup-widget/dist/`.

Before development and production builds, `npm run widget:publish` copies the
complete `chat-popup-widget/dist/` directory when widget sources have been built
locally, or uses the existing public bundle when that source bundle is absent.

To serve the widget from this Next.js application while preserving existing embeds,
copy the widget's complete `dist` directory (including any CSS and other assets) to
`public/chat-popup-widget/dist/` before building and deploying. Next.js serves
`public/chat-popup-widget/dist/chat-popup.iife.js` at
`/chat-popup-widget/dist/chat-popup.iife.js`; do not include `public` in the URL.

If the web server already serves `/chat-popup-widget/` from a separate directory,
keep that static route when configuring the proxy to Next.js. In that setup the
bundle does not need to be copied into this repository. Preserve any separate chat
API routes as well; serving the JavaScript file alone does not provide the backend.

For example, with Nginx, keep a dedicated static location inside the existing
HTTPS `server` block alongside the proxy location:

```nginx
location ^~ /chat-popup-widget/ {
    alias /absolute/path/to/chat-popup-widget/;
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Replace the example filesystem path and upstream port with the server's actual
values. Keep both trailing slashes in the static location and alias; the alias
directory must contain `dist/chat-popup.iife.js`. Retain existing MIME type
configuration so `.js` files are served as JavaScript.

The script URL is relative to the current origin, so local development loads the
local bundle. After deployment, verify that the URL returns JavaScript (not an HTML page
or a 404), then open the site and check that the chat opens and can send a message.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
