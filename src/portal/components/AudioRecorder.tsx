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
        className={`audio-btn audio-btn-rec${recording ? " is-recording" : ""}`}
      >
        {processing ? "..." : recording ? "Stop" : "Rec"}
      </button>
      {audio && (
        <>
          <button onClick={() => playAudio(audio)} title="Preview" className="audio-btn audio-btn-play">
            Play
          </button>
          <button onClick={() => onRecord(null)} title="Remove audio" className="audio-btn audio-btn-remove">
            x
          </button>
        </>
      )}
    </span>
  );
}
