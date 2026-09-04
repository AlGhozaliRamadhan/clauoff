/**
 * src/lib/tree-utils.ts
 * Core message tree, branching, versioning, and DAG traversal engine.
 * Powers Claude/ChatGPT-style message editing, checkpoints, retries, and version switching (e.g. < 1/2 >).
 */

import type { Message } from "@/components/chat/ChatThread";
import type { SourceCitation } from "@/lib/rag/types";
import type { GeneratedImageInfo } from "@/lib/images/types";
import { generateMessageId } from "@/store/conversation-store";

export interface MessageNode {
  id: string;
  role: "user" | "assistant";
  content: string;
  parentId: string | null;
  children: string[];
  createdAt: number;
  sources?: SourceCitation[];
  isStreaming?: boolean;
  responseType?: "chat" | "image";
  image?: GeneratedImageInfo;
}

export interface ConversationTreeState {
  mapping: Record<string, MessageNode>;
  currentLeafId: string | null;
}

/**
 * Ensures a conversation has a valid tree mapping and currentLeafId.
 * Automatically migrates existing linear messages into a linked tree without data loss.
 */
export function ensureTreeState(
  messages: Message[] = [],
  mapping?: Record<string, MessageNode>,
  currentLeafId?: string | null,
): ConversationTreeState {
  if (mapping && Object.keys(mapping).length > 0 && currentLeafId && mapping[currentLeafId]) {
    return { mapping, currentLeafId };
  }

  const newMapping: Record<string, MessageNode> = {};
  let parentId: string | null = null;
  const now = Date.now();

  for (const msg of messages) {
    newMapping[msg.id] = {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      parentId,
      children: [],
      createdAt: now,
      sources: msg.sources,
      isStreaming: msg.isStreaming,
      responseType: msg.responseType,
      image: msg.image,
    };

    if (parentId && newMapping[parentId]) {
      if (!newMapping[parentId].children.includes(msg.id)) {
        newMapping[parentId].children.push(msg.id);
      }
    }
    parentId = msg.id;
  }

  return {
    mapping: newMapping,
    currentLeafId: parentId,
  };
}

/**
 * Returns the linear sequence of messages along the path from root to currentLeafId.
 */
export function getLinearMessages(
  mapping: Record<string, MessageNode>,
  currentLeafId: string | null,
): Message[] {
  if (!currentLeafId || !mapping[currentLeafId]) {
    return [];
  }

  const result: Message[] = [];
  let currId: string | null = currentLeafId;
  const visited = new Set<string>();

  while (currId && mapping[currId]) {
    if (visited.has(currId)) break; // Cycle guard
    visited.add(currId);

    const node: MessageNode = mapping[currId];
    result.push({
      id: node.id,
      role: node.role,
      content: node.content,
      isStreaming: node.isStreaming,
      sources: node.sources,
      responseType: node.responseType,
      image: node.image,
    });

    currId = node.parentId;
  }

  return result.reverse();
}

/**
 * Returns sibling information for a message turn (e.g. 1 of 2, 2 of 2).
 */
export function getNodeSiblingInfo(
  mapping: Record<string, MessageNode>,
  nodeId: string,
): { siblings: string[]; currentIndex: number; total: number } {
  const node: MessageNode | undefined = mapping[nodeId];
  if (!node) {
    return { siblings: [nodeId], currentIndex: 0, total: 1 };
  }

  let siblings: string[] = [];

  if (node.parentId && mapping[node.parentId]) {
    siblings = mapping[node.parentId].children;
  } else {
    // Root nodes
    siblings = Object.values(mapping)
      .filter((n) => n.parentId === null && n.role === node.role)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((n) => n.id);
  }

  if (siblings.length === 0) {
    siblings = [nodeId];
  }

  const currentIndex = siblings.indexOf(nodeId);

  return {
    siblings,
    currentIndex: currentIndex >= 0 ? currentIndex : 0,
    total: siblings.length,
  };
}

/**
 * Finds the latest active leaf descending from a given target node.
 */
export function findLeafInBranch(
  mapping: Record<string, MessageNode>,
  startNodeId: string,
): string {
  let currId = startNodeId;
  const visited = new Set<string>();

  while (currId && mapping[currId]) {
    if (visited.has(currId)) break;
    visited.add(currId);

    const node: MessageNode = mapping[currId];
    if (!node.children || node.children.length === 0) {
      return currId;
    }
    // Always descend down the most recent child branch
    currId = node.children[node.children.length - 1];
  }

  return currId;
}

/**
 * Switches version to a sibling node and selects the active leaf of that branch.
 */
export function switchBranch(
  mapping: Record<string, MessageNode>,
  targetNodeId: string,
): string {
  if (!mapping[targetNodeId]) {
    return targetNodeId;
  }
  return findLeafInBranch(mapping, targetNodeId);
}

/**
 * Appends a new turn (User -> Assistant) to the active leaf of the conversation tree.
 */
export function appendNewTurn(
  mapping: Record<string, MessageNode>,
  currentLeafId: string | null,
  userText: string,
  responseType: "chat" | "image" = "chat",
): {
  mapping: Record<string, MessageNode>;
  userNode: MessageNode;
  assistantNode: MessageNode;
  newLeafId: string;
} {
  const newMapping = { ...mapping };
  const now = Date.now();

  const userNodeId = generateMessageId("user");
  const assistantNodeId = generateMessageId("assistant");

  const userNode: MessageNode = {
    id: userNodeId,
    role: "user",
    content: userText,
    parentId: currentLeafId,
    children: [assistantNodeId],
    createdAt: now,
  };

  const assistantNode: MessageNode = {
    id: assistantNodeId,
    role: "assistant",
    content: "",
    parentId: userNodeId,
    children: [],
    createdAt: now + 1,
    isStreaming: true,
    responseType,
  };

  if (currentLeafId && newMapping[currentLeafId]) {
    newMapping[currentLeafId] = {
      ...newMapping[currentLeafId],
      children: [...newMapping[currentLeafId].children, userNodeId],
    };
  }

  newMapping[userNodeId] = userNode;
  newMapping[assistantNodeId] = assistantNode;

  return {
    mapping: newMapping,
    userNode,
    assistantNode,
    newLeafId: assistantNodeId,
  };
}

/**
 * Forks a conversation at an edited user node and appends a new assistant response node.
 */
export function forkAndEditUserMessage(
  mapping: Record<string, MessageNode>,
  originalUserNodeId: string,
  newContent: string,
): {
  mapping: Record<string, MessageNode>;
  userNode: MessageNode;
  assistantNode: MessageNode;
  newLeafId: string;
} {
  const original = mapping[originalUserNodeId];
  if (!original) {
    throw new Error(`Original node ${originalUserNodeId} not found in tree`);
  }

  const newMapping = { ...mapping };
  const now = Date.now();
  const parentId = original.parentId;

  const newUserNodeId = generateMessageId("user");
  const newAssistantNodeId = generateMessageId("assistant");
  const originalAssistant = original.children
    .map((childId) => mapping[childId])
    .find((node) => node?.role === "assistant");

  const userNode: MessageNode = {
    id: newUserNodeId,
    role: "user",
    content: newContent,
    parentId,
    children: [newAssistantNodeId],
    createdAt: now,
  };

  const assistantNode: MessageNode = {
    id: newAssistantNodeId,
    role: "assistant",
    content: "",
    parentId: newUserNodeId,
    children: [],
    createdAt: now + 1,
    isStreaming: true,
    responseType: originalAssistant?.responseType ?? "chat",
  };

  if (parentId && newMapping[parentId]) {
    newMapping[parentId] = {
      ...newMapping[parentId],
      children: [...newMapping[parentId].children, newUserNodeId],
    };
  }

  newMapping[newUserNodeId] = userNode;
  newMapping[newAssistantNodeId] = assistantNode;

  return {
    mapping: newMapping,
    userNode,
    assistantNode,
    newLeafId: newAssistantNodeId,
  };
}

/**
 * Forks a conversation at an assistant message turn (Retry) and creates an alternative assistant response.
 */
export function forkAndRetryAssistantMessage(
  mapping: Record<string, MessageNode>,
  assistantNodeId: string,
): {
  mapping: Record<string, MessageNode>;
  assistantNode: MessageNode;
  newLeafId: string;
} {
  const original = mapping[assistantNodeId];
  if (!original) {
    throw new Error(`Original assistant node ${assistantNodeId} not found in tree`);
  }

  const userParentId = original.parentId;
  if (!userParentId || !mapping[userParentId]) {
    throw new Error(`Parent user node for assistant ${assistantNodeId} not found in tree`);
  }

  const newMapping = { ...mapping };
  const now = Date.now();
  const newAssistantNodeId = generateMessageId("assistant");

  const assistantNode: MessageNode = {
    id: newAssistantNodeId,
    role: "assistant",
    content: "",
    parentId: userParentId,
    children: [],
    createdAt: now,
    isStreaming: true,
    responseType: original.responseType ?? "chat",
  };

  newMapping[userParentId] = {
    ...newMapping[userParentId],
    children: [...newMapping[userParentId].children, newAssistantNodeId],
  };

  newMapping[newAssistantNodeId] = assistantNode;

  return {
    mapping: newMapping,
    assistantNode,
    newLeafId: newAssistantNodeId,
  };
}
