// Message entity: individual turns within a Conversation.
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('messages');

export async function addMessage({ conversationId, role, content, metadata = null }) {
  const message = { id: randomUUID(), conversation_id: conversationId, role, content, metadata, created_at: new Date().toISOString() };
  return store.insert(message);
}

export async function listMessages(conversationId) {
  const all = await store.filter((m) => m.conversation_id === conversationId);
  return all.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}
