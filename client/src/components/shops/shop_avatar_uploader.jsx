import { useRef, useState } from "react";
import { FiCamera, FiTrash2, FiUploadCloud } from "react-icons/fi";
import ShopAvatar from "./shop_avatar";

function ShopAvatarUploader({
  avatarUrl = "",
  disabled = false,
  onFileSelect,
  onRemove,
  progress = 0,
  previewUrl = "",
  removed = false,
  shopName = "Shop",
  uploading = false,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const displayUrl = removed ? "" : previewUrl || avatarUrl;

  const openPicker = () => {
    if (disabled || uploading) {
      return;
    }

    inputRef.current?.click();
  };

  const handleFile = (file) => {
    if (!file || disabled || uploading) {
      return;
    }

    onFileSelect?.(file);
  };

  const handleInputChange = (event) => {
    handleFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };

  const handleDragOver = (event) => {
    event.preventDefault();

    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const normalizedProgress = Math.min(100, Math.max(0, Number(progress) || 0));

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-5 text-center sm:flex-row sm:text-left">
      <button
        type="button"
        onClick={openPicker}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        disabled={disabled || uploading}
        className={`group relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-lg outline-none transition ${
          isDragging ? "scale-105 ring-4 ring-[#c446ff]/25" : ""
        } ${disabled || uploading ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:scale-105 focus:ring-4 focus:ring-[#c446ff]/20"}`}
        aria-label="Choose shop avatar"
      >
        <ShopAvatar src={displayUrl} name={shopName} size="xl" loading="eager" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/0 text-white transition group-hover:bg-slate-950/35">
          <FiCamera className="h-7 w-7 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">Shop Avatar</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          JPG, PNG, or WebP. Images are cropped square and resized to 512 x 512 px.
        </p>

        {uploading ? (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Uploading</span>
              <span>{Math.round(normalizedProgress)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#c446ff] transition-[width] duration-300"
                style={{ width: `${normalizedProgress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled || uploading}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#c446ff] bg-white px-4 text-xs font-semibold text-[#c446ff] transition hover:bg-[#f6e8ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiUploadCloud className="h-4 w-4" aria-hidden="true" />
            {displayUrl ? "Replace" : "Upload"}
          </button>
          {displayUrl ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled || uploading}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiTrash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="sr-only"
      />
    </div>
  );
}

export default ShopAvatarUploader;
