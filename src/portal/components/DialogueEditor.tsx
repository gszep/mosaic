import { useState, useCallback } from "react";
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
  allIds,
  onChange,
  giftObject,
}: {
  node: DialogueNode;
  depth: number;
  allIds: { id: string; preview: string }[];
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
          allIds={allIds}
          onChange={(r) => updateResponse(i, r)}
          onRemove={() => removeResponse(i)}
          giftObject={giftObject}
        />
      ))}

      {(!node.responses || node.responses.length < MAX_RESPONSES) && depth < MAX_DEPTH && (
        <button onClick={addResponse} style={{ fontSize: "0.8rem", marginTop: 2, marginBottom: 4 }}>
          + Add Fraser's response option
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
  allIds,
  onChange,
  onRemove,
  giftObject,
}: {
  response: DialogueResponse;
  depth: number;
  allIds: { id: string; preview: string }[];
  onChange: (updated: DialogueResponse) => void;
  onRemove: () => void;
  giftObject?: string | null;
}) {
  const [useGoto, setUseGoto] = useState(!!response.goto);

  const updateOption = (option: string) => onChange({ ...response, option });

  const toggleGoto = () => {
    if (useGoto) {
      setUseGoto(false);
      onChange({ option: response.option, next: { id: createId(), text: "", audio: null, responses: null } });
    } else {
      setUseGoto(true);
      onChange({ option: response.option, goto: allIds[0]?.id ?? "" });
    }
  };

  return (
    <div className="dialogue-response">
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span className="dialogue-label-fraser">Fraser:</span>
        <input
          type="text"
          value={response.option}
          onChange={(e) => updateOption(e.target.value)}
          placeholder="Fraser's response..."
          className="nes-input is-dark"
          style={{ flex: 1, fontSize: "10px" }}
        />
        <button onClick={onRemove} title="Remove response" className="nes-btn is-error" style={{ fontSize: "8px", padding: "2px 6px" }}>
          x
        </button>
      </div>

      <div style={{ fontSize: "0.8rem", marginTop: 2 }}>
        <label>
          <input type="checkbox" checked={useGoto} onChange={toggleGoto} />
          {" "}Redirect to earlier line
        </label>
      </div>

      {useGoto ? (
        <select
          value={response.goto ?? ""}
          onChange={(e) => onChange({ option: response.option, goto: e.target.value })}
          style={{ marginTop: 2, fontSize: "0.85rem" }}
        >
          {allIds.map((n) => (
            <option key={n.id} value={n.id}>
              {n.preview}
            </option>
          ))}
        </select>
      ) : response.next ? (
        <NodeEditor
          node={response.next}
          depth={depth + 1}
          allIds={allIds}
          onChange={(next) => onChange({ ...response, next })}
          giftObject={giftObject}
        />
      ) : null}
    </div>
  );
}

function collectIds(node: DialogueNode): { id: string; preview: string }[] {
  const result: { id: string; preview: string }[] = [];
  const visit = (n: DialogueNode) => {
    result.push({ id: n.id, preview: n.text.slice(0, 40) || "(empty)" });
    if (n.responses) {
      for (const r of n.responses) {
        if (r.next) visit(r.next);
      }
    }
  };
  visit(node);
  return result;
}

interface DialogueEditorProps {
  tree: DialogueNode | null;
  onChange: (tree: DialogueNode) => void;
  giftObject?: string | null;
}

export function DialogueEditor({ tree, onChange, giftObject }: DialogueEditorProps) {
  const root = tree ?? createDefaultTree();
  const allIds = collectIds(root);

  const handleChange = useCallback(
    (updated: DialogueNode) => {
      onChange(updated);
    },
    [onChange]
  );

  return (
    <div className="dialogue-editor">
      <NodeEditor node={root} depth={0} allIds={allIds} onChange={handleChange} giftObject={giftObject} />
    </div>
  );
}
