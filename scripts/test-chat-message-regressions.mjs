import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const projectRoot = new URL('../', import.meta.url);
const read = (relativePath) => fs.readFileSync(new URL(relativePath, projectRoot), 'utf8');

const teamChat = read('src/components/TeamChatCard.tsx');
const directMessages = read('src/hooks/useDirectMessages.ts');
const directMessageView = read('src/components/chat/DirectMessageView.tsx');
const teamChatPage = read('src/pages/TeamChatPage.tsx');
const messageOrdering = read('src/lib/chat/messageOrdering.ts');

const compiledMessageOrdering = ts.transpileModule(messageOrdering, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const messageOrderingContext = { exports: {} };
vm.runInNewContext(compiledMessageOrdering, messageOrderingContext);
const {
  toChronologicalMessages,
  addMessageChronologically,
  mergeChronologicalMessages,
} = messageOrderingContext.exports;

const newestFirst = [
  { id: 'new', created_at: '2026-08-19T03:00:00.000Z' },
  { id: 'middle', created_at: '2026-08-19T02:00:00.000Z' },
  { id: 'old', created_at: '2026-08-19T01:00:00.000Z' },
];
assert.deepEqual(
  Array.from(toChronologicalMessages(newestFirst), (message) => message.id),
  ['old', 'middle', 'new'],
);

const realtimeDuringFetch = [
  { id: 'realtime', created_at: '2026-08-19T04:00:00.000Z', message: '실시간' },
];
const fetchedAfterSubscription = [
  { id: 'old', created_at: '2026-08-19T01:00:00.000Z', message: 'old' },
  { id: 'middle', created_at: '2026-08-19T02:00:00.000Z', message: 'middle' },
  { id: 'realtime', created_at: '2026-08-19T04:00:00.000Z', message: 'DB complete row' },
];
const mergedAcrossQueryGap = mergeChronologicalMessages(
  realtimeDuringFetch,
  fetchedAfterSubscription,
  200,
);
assert.deepEqual(
  Array.from(mergedAcrossQueryGap, (message) => message.id),
  ['old', 'middle', 'realtime'],
  'Realtime inserts delivered during the fetch must survive query completion without duplicates',
);
assert.equal(
  mergedAcrossQueryGap.at(-1).message,
  'DB complete row',
  'The complete fetched row must win when query and Realtime contain the same id',
);
assert.deepEqual(Array.from(newestFirst, (message) => message.id), ['new', 'middle', 'old']);
assert.deepEqual(
  Array.from(
    addMessageChronologically(
      toChronologicalMessages(newestFirst),
      { id: 'latest', created_at: '2026-08-19T04:00:00.000Z' },
      3,
    ),
    (message) => message.id,
  ),
  ['middle', 'new', 'latest'],
);
assert.deepEqual(
  Array.from(
    addMessageChronologically(
      toChronologicalMessages(newestFirst),
      { id: 'new', created_at: '2026-08-19T03:00:00.000Z' },
      3,
    ),
    (message) => message.id,
  ),
  ['old', 'middle', 'new'],
);

assert.match(
  teamChat,
  /from\('team_messages'\)[\s\S]*?order\('created_at', \{ ascending: false \}\)[\s\S]*?limit\(100\)/,
  'Team chat must query the latest 100 messages before converting them to chronological display order',
);
assert.match(
  teamChat,
  /setMessages\(previousMessages => mergeChronologicalMessages\(previousMessages, fetchedMessages, 100\)\)/,
  'Team chat must merge the query result with Realtime inserts received while fetching',
);
assert.match(teamChat, /const \[loadError, setLoadError\] = useState<string \| null>\(null\)/);
assert.match(teamChat, /onClick=\{fetchMessages\}/);
assert.match(teamChat, /status === 'SUBSCRIBED'[\s\S]*?void fetchMessages\(\)/);

assert.match(
  directMessages,
  /from\('direct_messages'\)[\s\S]*?order\('created_at', \{ ascending: false \}\)[\s\S]*?limit\(200\)/,
  'Direct messages must query the latest 200 messages before converting them to chronological display order',
);
assert.match(
  directMessages,
  /setMessages\(previousMessages => mergeChronologicalMessages\(previousMessages, fetchedMessages, 200\)\)/,
  'Direct messages must merge the query result with Realtime inserts received while fetching',
);
assert.match(directMessages, /setMessages\(\[\]\);\s*setLoadError\(null\);/);
assert.match(directMessages, /fetchRequestIdRef\.current !== requestId/);
assert.match(directMessages, /return \{ messages, loading, loadError, sending, sendMessage, refetch: fetchMessages \}/);
assert.match(directMessages, /status === 'SUBSCRIBED'[\s\S]*?void fetchMessages\(\)/);
assert.match(teamChatPage, /<DirectMessageView\s+key=\{activeTarget\.partner\.user_id\}/);

assert.match(directMessageView, /loadError/);
assert.match(directMessageView, /onClick=\{refetch\}/);
assert.match(directMessageView, />\s*다시 시도/);

console.log('Chat message reliability regression checks passed.');
