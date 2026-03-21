import { useCallback } from "react";
import type { DialogueNode, DialogueResponse } from "../../shared/types";

const MAX_DEPTH = 4;
const MAX_RESPONSES = 3;

function createId(): string {
  return "n" + Math.random().toString(36).slice(2, 8);
}

function createDefaultTree(): DialogueNode {
  return {
    id: createId(),
    text: "Happy birthday!",
    audio: null,
    responses: null,
  };
}

function NodeEditor({
  node,
  depth,
  onChange,
  giftObject,
}: {
  node: DialogueNode;
  depth: number;
  onChange: (updated: DialogueNode) => void;
  giftObject?: string | null;
}) {
  const updateText = (text: string) => onChange({ ...node, text });

  const updateResponse = (idx: number, resp: DialogueResponse) => {
    const responses = (node.responses ?? []).slice();
    responses[idx] = resp;
    onChange({ ...node, responses });
  };

  const addResponse = () => {
    const responses = (node.responses ?? []).slice();
    if (responses.length >= MAX_RESPONSES) return;
    responses.push({ option: "", next: { id: createId(), text: "", audio: null, responses: null } });
    onChange({ ...node, responses });
  };

  const removeResponse = (idx: number) => {
    const responses = (node.responses ?? []).slice();
    responses.splice(idx, 1);
    onChange({ ...node, responses: responses.length > 0 ? responses : null });
  };

  return (
    <div className={depth > 0 ? "dialogue-node-inner" : "dialogue-node"}>
      <div style={{ display: "flex", alignItems: "start", gap: 4, marginBottom: 4 }}>
        <span className="dialogue-label-you">You:</span>
        <textarea
          value={node.text}
          onChange={(e) => updateText(e.target.value)}
          placeholder="What do you say to Fraser?"
          rows={2}
          className="nes-textarea is-dark"
          style={{ fontSize: "10px", resize: "vertical" }}
        />
      </div>

      {node.responses?.map((resp, i) => (
        <ResponseEditor
          key={i}
          response={resp}
          depth={depth}
          onChange={(r) => updateResponse(i, r)}
          onRemove={() => removeResponse(i)}
          giftObject={giftObject}
        />
      ))}

      {(!node.responses || node.responses.length < MAX_RESPONSES) && depth < MAX_DEPTH && (
        <button onClick={addResponse} style={{ fontSize: "0.8rem", marginTop: 2, marginBottom: 4 }}>
          + response option for turn {depth + 1}
        </button>
      )}

      {!node.responses && (
        <div style={{ color: "#888", fontSize: "0.8rem", fontStyle: "italic", marginTop: 2 }}>
          {giftObject ? `Gives Fraser ${giftObject}` : "End of conversation (gives gift)"}
        </div>
      )}
    </div>
  );
}

function ResponseEditor({
  response,
  depth,
  onChange,
  onRemove,
  giftObject,
}: {
  response: DialogueResponse;
  depth: number;
  onChange: (updated: DialogueResponse) => void;
  onRemove: () => void;
  giftObject?: string | null;
}) {
  return (
    <div className="dialogue-response">
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span className="dialogue-label-fraser">Fraser:</span>
        <input
          type="text"
          value={response.option}
          onChange={(e) => onChange({ ...response, option: e.target.value })}
          placeholder="Fraser's response..."
          className="nes-input is-dark"
          style={{ flex: 1, fontSize: "10px" }}
        />
        <button onClick={onRemove} title="Remove response" className="nes-btn is-error" style={{ fontSize: "8px", padding: "2px 6px" }}>
          x
        </button>
      </div>

      {response.next && (
        <NodeEditor
          node={response.next}
          depth={depth + 1}
          onChange={(next) => onChange({ ...response, next })}
          giftObject={giftObject}
        />
      )}
    </div>
  );
}

interface DialogueEditorProps {
  tree: DialogueNode | null;
  onChange: (tree: DialogueNode) => void;
  giftObject?: string | null;
}

export function DialogueEditor({ tree, onChange, giftObject }: DialogueEditorProps) {
  const root = tree ?? createDefaultTree();

  const handleChange = useCallback(
    (updated: DialogueNode) => {
      onChange(updated);
    },
    [onChange]
  );

  return (
    <div className="dialogue-editor">
      <NodeEditor node={root} depth={0} onChange={handleChange} giftObject={giftObject} />
    </div>
  );
}
