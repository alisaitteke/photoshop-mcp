import type { LanguageModelUsage } from 'ai';
import { randomUUID } from 'node:crypto';
import type { UsageCost } from '../providers/registry.js';
import { getDB } from './db.js';

export interface ChatRow {
  id: string;
  title: string;
  provider: string;
  model: string;
  sessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MessageContent {
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: unknown;
    result?: { ok: boolean; content: string };
    status: 'pending' | 'success' | 'error';
  }>;
  usage?: LanguageModelUsage;
  cost?: UsageCost;
  provider?: string;
  model?: string;
  /** Present only for Action Plan (beta) runs. */
  plan?: {
    summary: string;
    steps: Array<{
      id: string;
      tool: string;
      rationale?: string;
      status: 'pending' | 'running' | 'done' | 'error';
    }>;
  };
}

export interface MessageRow {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: MessageContent;
  createdAt: number;
}

interface RawChatRow {
  id: string;
  title: string;
  provider: string;
  model: string;
  session_id: string | null;
  created_at: number;
  updated_at: number;
}

interface RawMessageRow {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  created_at: number;
}

function rowToChat(row: RawChatRow): ChatRow {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    model: row.model,
    sessionId: row.session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: RawMessageRow): MessageRow {
  return {
    id: row.id,
    chatId: row.chat_id,
    role: row.role as 'user' | 'assistant',
    content: JSON.parse(row.content) as MessageContent,
    createdAt: row.created_at,
  };
}

export function listChats(): ChatRow[] {
  const rows = getDB()
    .prepare<[], RawChatRow>('SELECT * FROM chats ORDER BY updated_at DESC')
    .all();
  return rows.map(rowToChat);
}

export function getChat(id: string): ChatRow | null {
  const row = getDB()
    .prepare<[string], RawChatRow>('SELECT * FROM chats WHERE id = ?')
    .get(id);
  return row ? rowToChat(row) : null;
}

export function getMessages(chatId: string): MessageRow[] {
  const rows = getDB()
    .prepare<[string], RawMessageRow>(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC'
    )
    .all(chatId);
  return rows.map(rowToMessage);
}

export function createChat(input: {
  provider: string;
  model: string;
  title?: string;
}): ChatRow {
  const now = Date.now();
  const chat: ChatRow = {
    id: randomUUID(),
    title: input.title ?? 'New chat',
    provider: input.provider,
    model: input.model,
    sessionId: null,
    createdAt: now,
    updatedAt: now,
  };
  getDB()
    .prepare(
      `INSERT INTO chats (id, title, provider, model, session_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(chat.id, chat.title, chat.provider, chat.model, chat.sessionId, chat.createdAt, chat.updatedAt);
  return chat;
}

export function appendMessage(input: {
  chatId: string;
  role: 'user' | 'assistant';
  content: MessageContent;
}): MessageRow {
  const now = Date.now();
  const msg: MessageRow = {
    id: randomUUID(),
    chatId: input.chatId,
    role: input.role,
    content: input.content,
    createdAt: now,
  };
  const db = getDB();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(msg.id, msg.chatId, msg.role, JSON.stringify(msg.content), msg.createdAt);
    db.prepare(`UPDATE chats SET updated_at = ? WHERE id = ?`).run(now, input.chatId);
  });
  tx();
  return msg;
}

export function renameChat(id: string, title: string): void {
  getDB().prepare(`UPDATE chats SET title = ?, updated_at = ? WHERE id = ?`).run(title, Date.now(), id);
}

export function updateChatModel(id: string, provider: string, model: string): void {
  getDB()
    .prepare(`UPDATE chats SET provider = ?, model = ?, updated_at = ? WHERE id = ?`)
    .run(provider, model, Date.now(), id);
}

export function deleteChat(id: string): void {
  getDB().prepare(`DELETE FROM chats WHERE id = ?`).run(id);
}

export function setChatSessionId(id: string, sessionId: string | null): void {
  getDB().prepare(`UPDATE chats SET session_id = ? WHERE id = ?`).run(sessionId, id);
}
