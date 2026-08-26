import { describe, it, expect } from "vitest";
import {
  ensureTreeState,
  getLinearMessages,
  getNodeSiblingInfo,
  switchBranch,
  appendNewTurn,
  forkAndEditUserMessage,
  forkAndRetryAssistantMessage,
} from "../tree-utils";
import type { Message } from "@/components/ChatThread";

describe("Conversation Tree & Branching Engine", () => {
  it("migrates flat messages to a connected tree structure", () => {
    const flat: Message[] = [
      { id: "u1", role: "user", content: "Hello" },
      { id: "a1", role: "assistant", content: "Hello! How can I help?" },
    ];

    const { mapping, currentLeafId } = ensureTreeState(flat);
    expect(currentLeafId).toBe("a1");
    expect(mapping["u1"].parentId).toBeNull();
    expect(mapping["u1"].children).toEqual(["a1"]);
    expect(mapping["a1"].parentId).toBe("u1");

    const linear = getLinearMessages(mapping, currentLeafId);
    expect(linear.length).toBe(2);
    expect(linear[0].content).toBe("Hello");
    expect(linear[1].content).toBe("Hello! How can I help?");
  });

  it("appends new turns to the active leaf", () => {
    let { mapping, currentLeafId } = ensureTreeState([]);
    expect(currentLeafId).toBeNull();

    // Turn 1
    const turn1 = appendNewTurn(mapping, currentLeafId, "hello");
    mapping = turn1.mapping;
    currentLeafId = turn1.newLeafId;

    expect(currentLeafId).toBe(turn1.assistantNode.id);
    let linear = getLinearMessages(mapping, currentLeafId);
    expect(linear.length).toBe(2);
    expect(linear[0].content).toBe("hello");

    // Turn 2
    const turn2 = appendNewTurn(mapping, currentLeafId, "i want to make x with Y");
    mapping = turn2.mapping;
    currentLeafId = turn2.newLeafId;

    linear = getLinearMessages(mapping, currentLeafId);
    expect(linear.length).toBe(4);
    expect(linear[2].content).toBe("i want to make x with Y");
  });

  it("handles user editing: forks message and creates a branch checkpoint (1/2, 2/2)", () => {
    // 1. Initial conversation
    let { mapping, currentLeafId } = ensureTreeState([]);
    const t1 = appendNewTurn(mapping, currentLeafId, "hello");
    mapping = t1.mapping;
    mapping[t1.assistantNode.id].content = "Hello there!";
    currentLeafId = t1.newLeafId;

    const t2 = appendNewTurn(mapping, currentLeafId, "i want to make x with Y");
    mapping = t2.mapping;
    mapping[t2.assistantNode.id].content = "Here is x with Y.";
    currentLeafId = t2.newLeafId;

    expect(getLinearMessages(mapping, currentLeafId).length).toBe(4);

    // Check version before edit: 1/1
    let sibInfo = getNodeSiblingInfo(mapping, t2.userNode.id);
    expect(sibInfo.total).toBe(1);
    expect(sibInfo.currentIndex).toBe(0);

    // 2. User edits "i want to make x with Y" -> "I want to make x with Z"
    const fork = forkAndEditUserMessage(mapping, t2.userNode.id, "I want to make x with Z");
    mapping = fork.mapping;
    mapping[fork.assistantNode.id].content = "Here is x with Z.";
    currentLeafId = fork.newLeafId;

    // Now user turn 2 has 2 versions:
    sibInfo = getNodeSiblingInfo(mapping, fork.userNode.id);
    expect(sibInfo.total).toBe(2);
    expect(sibInfo.currentIndex).toBe(1); // Version 2 of 2
    expect(sibInfo.siblings[0]).toBe(t2.userNode.id);
    expect(sibInfo.siblings[1]).toBe(fork.userNode.id);

    // Current linear path shows version 2
    let linear = getLinearMessages(mapping, currentLeafId);
    expect(linear.length).toBe(4);
    expect(linear[2].content).toBe("I want to make x with Z");
    expect(linear[3].content).toBe("Here is x with Z.");

    // 3. Switch back to Version 1
    const v1Leaf = switchBranch(mapping, t2.userNode.id);
    linear = getLinearMessages(mapping, v1Leaf);
    expect(linear.length).toBe(4);
    expect(linear[2].content).toBe("i want to make x with Y");
    expect(linear[3].content).toBe("Here is x with Y.");

    // Check sibling info from Version 1 perspective
    const v1SibInfo = getNodeSiblingInfo(mapping, t2.userNode.id);
    expect(v1SibInfo.total).toBe(2);
    expect(v1SibInfo.currentIndex).toBe(0); // Version 1 of 2
  });

  it("handles assistant retry: creates alternative response branch (1/2, 2/2)", () => {
    let { mapping, currentLeafId } = ensureTreeState([]);
    const t1 = appendNewTurn(mapping, currentLeafId, "hello");
    mapping = t1.mapping;
    mapping[t1.assistantNode.id].content = "Response Attempt 1";
    currentLeafId = t1.newLeafId;

    // Retry assistant message
    const retry = forkAndRetryAssistantMessage(mapping, t1.assistantNode.id);
    mapping = retry.mapping;
    mapping[retry.assistantNode.id].content = "Response Attempt 2";
    currentLeafId = retry.newLeafId;

    // Assistant now has 2 versions under the same user node
    const sibInfo = getNodeSiblingInfo(mapping, retry.assistantNode.id);
    expect(sibInfo.total).toBe(2);
    expect(sibInfo.currentIndex).toBe(1); // Version 2 of 2

    let linear = getLinearMessages(mapping, currentLeafId);
    expect(linear[1].content).toBe("Response Attempt 2");

    // Switch back to Attempt 1
    const v1Leaf = switchBranch(mapping, t1.assistantNode.id);
    linear = getLinearMessages(mapping, v1Leaf);
    expect(linear[1].content).toBe("Response Attempt 1");
  });
});
