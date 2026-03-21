import { useState, useCallback, type FormEvent } from "react";

const EXPECTED_HASH = "c6c55bcabd3ef494417c2c326b9ab4d6171eca5f0f4086ab57d5db74a0151303";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem("mosaic-authed") === "true"
  );
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = new FormData(e.currentTarget).get("password") as string;
    const hash = await sha256(input.trim());
    if (hash === EXPECTED_HASH) {
      sessionStorage.setItem("mosaic-authed", "true");
      setAuthed(true);
    } else {
      setError(true);
    }
  }, []);

  if (authed) return <>{children}</>;

  return (
    <form onSubmit={handleSubmit} className="password-gate">
      <div className="nes-container is-dark is-rounded" style={{ textAlign: "center" }}>
        <h2 style={{ marginTop: 0 }}>Enter Password</h2>
        <div className="nes-field" style={{ marginBottom: "1rem" }}>
          <input type="password" name="password" autoFocus className="nes-input is-dark" />
        </div>
        <button type="submit" className="nes-btn is-primary">Enter</button>
        {error && <p style={{ color: "#e76e55", marginTop: "0.5rem" }}>Incorrect password.</p>}
      </div>
    </form>
  );
}
