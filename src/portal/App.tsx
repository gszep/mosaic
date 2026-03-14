import { PasswordGate } from "./components/PasswordGate";
import { SubmissionForm } from "./components/SubmissionForm";

export function App() {
  return (
    <PasswordGate>
      <SubmissionForm />
    </PasswordGate>
  );
}
