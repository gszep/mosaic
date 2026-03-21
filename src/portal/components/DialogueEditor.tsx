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
    responses: null,
  };
}

function NodeEditor({
  node,
  depth,
  allIds,
  onChange,
}: {
  node: DialogueNode;
  depth: number;
  allIds: { id: string; preview: string }[];
  onChange: (updated: DialogueNode) => void;
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
    responses.push({ option: "", next: { id: createId(), text: "", responses: null } });
    onChange({ ...node, responses });
  };

  const removeResponse = (idx: number) => {
    const responses = (node.responses ?? []).slice();
    responses.splice(idx, 1);
    onChange({ ...node, responses: responses.length > 0 ? responses : null });
  };

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0, borderLeft: depth > 0 ? "2px solid #555" : "none", paddingLeft: depth > 0 ? 8 : 0, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "start", gap: 4, marginBottom: 4 }}>
        <span style={{ color: "#E95420", fontWeight: "bold", flexShrink: 0 }}>NPC:</span>
        <textarea
          value={node.text}
          onChange={(e) => updateText(e.target.value)}
          placeholder="What does your character say?"
          rows={2}
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit", fontSize: "0.9rem" }}
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
        />
      ))}

      {(!node.responses || node.responses.length < MAX_RESPONSES) && depth < MAX_DEPTH && (
        <button onClick={addResponse} style={{ fontSize: "0.8rem", marginTop: 2, marginBottom: 4 }}>
          + Add player response
        </button>
      )}

      {!node.responses && (
        <div style={{ color: "#888", fontSize: "0.8rem", fontStyle: "italic", marginTop: 2 }}>
          End of conversation (gives gift)
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
}: {
  response: DialogueResponse;
  depth: number;
  allIds: { id: string; preview: string }[];
  onChange: (updated: DialogueResponse) => void;
  onRemove: () => void;
}) {
  const [useGoto, setUseGoto] = useState(!!response.goto);

  const updateOption = (option: string) => onChange({ ...response, option });

  const toggleGoto = () => {
    if (useGoto) {
      setUseGoto(false);
      onChange({ option: response.option, next: { id: createId(), text: "", responses: null } });
    } else {
      setUseGoto(true);
      onChange({ option: response.option, goto: allIds[0]?.id ?? "" });
    }
  };

  return (
    <div style={{ marginLeft: 16, marginTop: 4, borderLeft: "2px solid #E95420", paddingLeft: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "#7ec8e3", fontWeight: "bold", flexShrink: 0 }}>Player:</span>
        <input
          type="text"
          value={response.option}
          onChange={(e) => updateOption(e.target.value)}
          placeholder="Player response..."
          style={{ flex: 1, fontFamily: "inherit", fontSize: "0.9rem" }}
        />
        <button onClick={onRemove} title="Remove response" style={{ fontSize: "0.8rem", color: "#c44" }}>
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
}

export function DialogueEditor({ tree, onChange }: DialogueEditorProps) {
  const root = tree ?? createDefaultTree();
  const allIds = collectIds(root);

  const handleChange = useCallback(
    (updated: DialogueNode) => {
      onChange(updated);
    },
    [onChange]
  );

  return (
    <div style={{ background: "#1a1a2e", padding: 12, borderRadius: 4, color: "#eee" }}>
      <NodeEditor node={root} depth={0} allIds={allIds} onChange={handleChange} />
    </div>
  );
}
