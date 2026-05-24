import { useState } from "react";

type Props = {
  label: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
};

export function FileDrop({ label, multiple, onFiles }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length) onFiles(arr);
  };

  return (
    <label
      className={`drop-zone ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {label}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
