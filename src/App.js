import React, { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { pipeline } from "@xenova/transformers";
import "./App.css";

const ffmpeg = new FFmpeg();

export default function App() {
  const videoRef = useRef(null);

  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [status, setStatus] = useState("Idle");
  const [model, setModel] = useState(null);

  // Load FFmpeg
  useEffect(() => {
    (async () => {
      await ffmpeg.load({
        coreURL: "/ffmpeg/ffmpeg-core.js",
        wasmURL: "/ffmpeg/ffmpeg-core.wasm",
        workerURL: "/ffmpeg/ffmpeg-core.worker.js",
      });
    })();
  }, []);

  // Load Whisper
  useEffect(() => {
    (async () => {
      setStatus("Loading AI Models");
      const whisper = await pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-tiny.en"
      );
      setModel(whisper);
      setStatus("Idle");
    })();
  }, []);

  async function handleUpload(file) {
    if (!file || file.size > 100_000_000) return;
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    await transcribe(file);
  }

  async function transcribe(file) {
    setStatus("Transcribing");
    const audioURL = URL.createObjectURL(file);
    const result = await model(audioURL, { chunk_length_s: 30 });
    setTranscript(
      result.chunks.map((c, i) => ({
        id: i,
        start: c.timestamp[0],
        end: c.timestamp[1],
        text: c.text,
      }))
    );
    setStatus("Idle");
  }

  function updateText(id, value) {
    setTranscript((t) =>
      t.map((line) => (line.id === id ? { ...line, text: value } : line))
    );
  }

  function toSRT() {
    return transcript
      .map((t, i) => {
        const fmt = (s) =>
          new Date(s * 1000).toISOString().substr(11, 12).replace(".", ",");
        return `${i + 1}\n${fmt(t.start)} --> ${fmt(t.end)}\n${t.text}\n`;
      })
      .join("\n");
  }

  async function burnVideo() {
    setStatus("Burning Video");

    await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));
    await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(toSRT()));

    await ffmpeg.exec([
      "-i",
      "input.mp4",
      "-vf",
      "subtitles=subs.srt:force_style='Fontsize=24,PrimaryColour=&HFFFFFF&'",
      "-preset",
      "ultrafast",
      "output.mp4",
    ]);

    const data = await ffmpeg.readFile("output.mp4");
    const url = URL.createObjectURL(
      new Blob([data.buffer], { type: "video/mp4" })
    );

    const a = document.createElement("a");
    a.href = url;
    a.download = "vibesync.mp4";
    a.click();

    setStatus("Idle");
  }

  return (
    <div className="app">
      <header className="hero">
        <h1>VibeSync AI</h1>
        <p>Auto captions. Fully local. Zero servers.</p>
        <label className="upload">
          Upload Video
          <input
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => handleUpload(e.target.files[0])}
          />
        </label>
        <span className="status">{status}</span>
      </header>

      {videoURL && (
        <div className="content">
          <div className="preview">
            <ReactPlayer
              ref={videoRef}
              url={videoURL}
              controls
              width="100%"
              height="100%"
            />
            <div className="caption">
              {
                transcript.find(
                  (t) =>
                    videoRef.current?.getCurrentTime() >= t.start &&
                    videoRef.current?.getCurrentTime() <= t.end
                )?.text
              }
            </div>
          </div>

          <div className="editor">
            {transcript.map((t) => (
              <textarea
                key={t.id}
                value={t.text}
                onChange={(e) => updateText(t.id, e.target.value)}
              />
            ))}
            <button onClick={burnVideo}>Download</button>
          </div>
        </div>
      )}
    </div>
  );
}
