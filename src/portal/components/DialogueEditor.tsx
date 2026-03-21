import { useCallback } from "react";
import type { DialogueNode, DialogueResponse } from "../../shared/types";

const MAX_DEPTH = 4;
const MAX_RESPONSES = 3;

function createId(): string {
  return "n" + Math.random().toString(36).slice(2, 8);
}

function createDefaultTree(): DialogueNode {
  return { id: createId(), text: "Happy birthday!", audio: null, responses: null };
}

function newNode(): DialogueNode {
  return { id: createId(), text: "", audio: null, responses: null };
}

interface DialogueEditorProps {
  tree: DialogueNode | null;
  onChange: (tree: DialogueNode) => void;
  giftObject?: string | null;
}

export function DialogueEditor({ tree, onChange, giftObject }: DialogueEditorProps) {
  const root = tree ?? createDefaultTree();
  const handleChange = useCallback((updated: DialogueNode) => onChange(updated), [onChange]);

  return (
    <div className="dialogue-editor">
      <TreeNode node={root} depth={0} onChange={handleChange} giftObject={giftObject} />
    </div>
  );
}

function TreeNode({
  node, depth, onChange, giftObject,
}: {
  node: DialogueNode;
  depth: number;
  onChange: (n: DialogueNode) => void;
  giftObject?: string | null;
}) {
  const updateText = (text: string) => onChange({ ...node, text });
  const updateResponse = (i: number, r: DialogueResponse) => {
    const responses = (node.responses ?? []).slice();
    responses[i] = r;
    onChange({ ...node, responses });
  };
  const addResponse = () => {
    const responses = (node.responses ?? []).slice();
    if (responses.length >= MAX_RESPONSES) return;
    responses.push({ option: "", next: newNode() });
    onChange({ ...node, responses });
  };
  const removeResponse = (i: number) => {
    const responses = (node.responses ?? []).slice();
    responses.splice(i, 1);
    onChange({ ...node, responses: responses.length > 0 ? responses : null });
  };

  return (
    <div className="dtree-branch">
      {/* NPC node */}
      <div className="dtree-node dtree-npc">
        <span className="dtree-tag dtree-tag-you">You</span>
        <textarea
          value={node.text}
          onChange={(e) => updateText(e.target.value)}
          placeholder="What do you say?"
          rows={2}
          className="nes-textarea is-dark"
          style={{ fontSize: "10px", resize: "vertical", width: "100%" }}
        />
      </div>

      {/* Connector down */}
      {(node.responses || depth < MAX_DEPTH) && <div className="dtree-connector" />}

      {/* Player responses */}
      {node.responses && (
        <div className="dtree-responses">
          {node.responses.map((resp, i) => (
            <div key={i} className="dtree-response-branch">
              <div className="dtree-connector-h" />
              <div className="dtree-node dtree-player">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span className="dtree-tag dtree-tag-fraser">Fraser</span>
                  <button onClick={() => removeResponse(i)} className="nes-btn is-error" style={{ fontSize: "7px", padding: "1px 4px", marginLeft: "auto" }}>x</button>
                </div>
                <input
                  type="text"
                  value={resp.option}
                  onChange={(e) => updateResponse(i, { ...resp, option: e.target.value })}
                  placeholder="Fraser says..."
                  className="nes-input is-dark"
                  style={{ fontSize: "10px", width: "100%" }}
                />
              </div>
              {/* Recurse into NPC reply */}
              {resp.next && (
                <>
                  <div className="dtree-connector" />
                  <TreeNode
                    node={resp.next}
                    depth={depth + 1}
                    onChange={(next) => updateResponse(i, { ...resp, next })}
                    giftObject={giftObject}
                  />
                </>
              )}
              {!resp.next && (
                <div className="dtree-leaf">
                  {giftObject ? `Gives Fraser ${giftObject}` : "End (gives gift)"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add response button */}
      {(!node.responses || node.responses.length < MAX_RESPONSES) && depth < MAX_DEPTH && (
        <button onClick={addResponse} className="nes-btn is-dark dtree-add" style={{ fontSize: "8px" }}>
          + response option for turn {depth + 1}
        </button>
      )}

      {/* Leaf: no responses */}
      {!node.responses && depth > 0 && (
        <div className="dtree-leaf">
          {giftObject ? `Gives Fraser ${giftObject}` : "End (gives gift)"}
        </div>
      )}

      {/* Root leaf */}
      {!node.responses && depth === 0 && (
        <div className="dtree-leaf">
          {giftObject ? `Gives Fraser ${giftObject}` : "End (gives gift)"}
        </div>
      )}
    </div>
  );
}
