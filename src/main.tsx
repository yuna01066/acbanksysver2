import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const bootChannelTalk = () => {
  const pluginKey = import.meta.env.VITE_CHANNEL_TALK_PLUGIN_KEY as string | undefined;
  if (!pluginKey) return;

  type ChannelWindow = Window & {
    ChannelIO?: ((...args: unknown[]) => void) & {
      q?: unknown[];
      c?: (args: IArguments) => void;
    };
    ChannelIOInitialized?: boolean;
  };

  const channelWindow = window as ChannelWindow;
  if (channelWindow.ChannelIO) return;

  const channelIO = function (...args: unknown[]) {
    channelIO.c?.(arguments);
  } as NonNullable<ChannelWindow['ChannelIO']>;
  channelIO.q = [];
  channelIO.c = (args: IArguments) => channelIO.q?.push(args);
  channelWindow.ChannelIO = channelIO;

  const loadScript = () => {
    if (channelWindow.ChannelIOInitialized) return;
    channelWindow.ChannelIOInitialized = true;
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(script, firstScript);
  };

  if (document.readyState === 'complete') {
    loadScript();
  } else {
    window.addEventListener('DOMContentLoaded', loadScript);
    window.addEventListener('load', loadScript);
  }

  channelWindow.ChannelIO('boot', {
    pluginKey,
    hideChannelButtonOnBoot: true,
  });
};

bootChannelTalk();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
