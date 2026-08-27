import { createApplication } from "./createApplication";
import { OperationalShell } from "../features/shell/OperationalShell";

const operations = createApplication();

export function App() {
  const result = operations.scenarioCurrent();

  if (!result.ok) {
    return <main className="console-unavailable">Console data is unavailable.</main>;
  }

  return <OperationalShell scenario={result.data} />;
}
