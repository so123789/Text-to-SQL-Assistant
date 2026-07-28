import React, { useRef, useState } from "react";
import { Upload, X, Database, RotateCcw, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useSql } from "../../context/SqlContext";
import "./UploadDB.css";

export default function UploadDB({ onClose }) {
  const { setSchema } = useSql();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedInfo, setUploadedInfo] = useState(null);
  const inputRef = useRef();

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setSchema(data.schema);
      setUploadedInfo({
        tables: Object.keys(data.schema).length,
        message: data.message,
      });
      toast.success(data.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleReset() {
    setUploading(true);
    try {
      const res = await fetch("/api/upload/reset", { method: "POST" });
      const data = await res.json();
      setSchema(data.schema);
      setUploadedInfo(null);
      toast.success("Back to demo database");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="upload-overlay" onClick={onClose}>
      <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upload-modal-header">
          <div className="upload-modal-title">
            <Database size={16} />
            <span>Upload Your Database</span>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="upload-modal-body">
          {/* Format info */}
          <div className="format-chips">
            {[
              { ext: ".csv", desc: "one table per file, multiple ok" },
              { ext: ".sqlite / .db", desc: "full SQLite database" },
              { ext: ".sql", desc: "CREATE + INSERT dump" },
            ].map(({ ext, desc }) => (
              <div key={ext} className="format-chip">
                <span className="format-ext">{ext}</span>
                <span className="format-desc">{desc}</span>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          <div
            className={`drop-zone ${dragging ? "dragging" : ""} ${uploading ? "busy" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".csv,.sqlite,.db,.sql"
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <>
                <div className="upload-spinner" />
                <p>Processing…</p>
              </>
            ) : uploadedInfo ? (
              <>
                <CheckCircle size={28} className="upload-success-icon" />
                <p className="upload-success-text">{uploadedInfo.message}</p>
                <span className="upload-hint">Drop new files to replace</span>
              </>
            ) : (
              <>
                <Upload size={28} className="upload-icon" />
                <p>Drag & drop files here</p>
                <span className="upload-hint">or click to browse</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="upload-actions">
            <button className="btn-reset-demo" onClick={handleReset} disabled={uploading}>
              <RotateCcw size={13} /> Use Demo Database
            </button>
            {uploadedInfo && (
              <button className="btn-done" onClick={onClose}>
                Done — Start Querying
              </button>
            )}
          </div>

          <p className="upload-note">
            Files are loaded in-memory only — nothing is saved to disk.
          </p>
        </div>
      </div>
    </div>
  );
}
