import { useAudioRecorder, playAudio } from "../hooks/useAudioRecorder";

interface AudioRecorderProps {
  audio: string | null;
  onRecord: (dataUrl: string | null) => void;
}

export function AudioRecorder({ audio, onRecord }: AudioRecorderProps) {
  const { recording, processing, start, stop } = useAudioRecorder();

  const handleToggle = async () => {
    if (recording) {
      const result = await stop();
      if (result) onRecord(result);
    } else {
      await start();
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 4 }}>
      <button
        onClick={handleToggle}
        disabled={processing}
        title={recording ? "Stop recording" : "Record dialogue sound (max 3s)"}
        style={{
          fontSize: "0.75rem",
          padding: "1px 5px",
          background: recording ? "#c44" : "#555",
          color: "#fff",
          border: "none",
          borderRadius: 3,
          cursor: processing ? "wait" : "pointer",
        }}
      >
        {processing ? "..." : recording ? "Stop" : "Rec"}
      </button>
      {audio && (
        <>
          <button
            onClick={() => playAudio(audio)}
            title="Preview"
            style={{
              fontSize: "0.75rem",
              padding: "1px 5px",
              background: "#3a6",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Play
          </button>
          <button
            onClick={() => onRecord(null)}
            title="Remove audio"
            style={{
              fontSize: "0.7rem",
              padding: "1px 4px",
              background: "transparent",
              color: "#c44",
              border: "none",
              cursor: "pointer",
            }}
          >
            x
          </button>
        </>
      )}
    </span>
  );
}
