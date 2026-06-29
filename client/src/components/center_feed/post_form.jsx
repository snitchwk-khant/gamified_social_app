import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/theme_context";
import { useAuth } from "../../context/auth_context";

const MAX_POST_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const POST_IMAGE_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const POST_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function PostForm({ value, onChange, onSubmit }) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const imageInputRef = useRef(null);
  const { isDark } = useTheme();
  const { user } = useAuth();

  const adminDisplayName = user?.full_name || user?.name || "Administrator";
  const adminInitial = (adminDisplayName?.charAt(0) || "A").toUpperCase();

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [selectedImage]);

  const handleSubmit = async () => {
    const trimmedValue = value?.trim();

    if (!trimmedValue && !selectedImage) {
      setError("Write something or add an image to publish.");
      return;
    }

    setError("");
    setPublishing(true);

    try {
      const result = await onSubmit(trimmedValue, isAnonymous, selectedImage);

      if (result === false || result?.success === false) {
        setError(result?.error || "Something went wrong. Please try again.");
      } else {
        setSelectedImage(null);
      }
    } catch (submitError) {
      setError(submitError?.message || "Something went wrong. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenImagePicker = () => {
    if (publishing) {
      return;
    }

    imageInputRef.current?.click();
  };

  const handleImageChange = (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;

    if (!file) {
      return;
    }

    const validationMessage = validatePostImage(file);

    if (validationMessage) {
      setError(validationMessage);
      setSelectedImage(null);
      input.value = "";
      return;
    }

    setError("");
    setSelectedImage(file);
    input.value = "";
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setError("");
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition duration-300 sm:p-6 ${
        isDark
          ? "border-slate-800 bg-slate-900 shadow-lg shadow-slate-950/10 hover:border-slate-700"
          : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
      }`}
    >
      <textarea
        rows="4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Share a story, milestone, or update with your team..."
        className={`w-full resize-none rounded-2xl border px-4 py-4 text-sm outline-none transition ${
          isDark
            ? "border-slate-800 bg-slate-950 text-slate-100 focus:border-sky-500"
            : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
        }`}
      />

      {previewUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <div className="relative">
            <img
              src={previewUrl}
              alt="Selected post preview"
              className="max-h-[360px] w-full object-contain"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={publishing}
              className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <p className={`mt-3 text-sm ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className={`flex flex-wrap items-center gap-4 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          <span className={`${isDark ? "text-slate-400" : "text-slate-500"}`}>Post as</span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAnonymous(false)}
              aria-pressed={!isAnonymous}
              aria-label="Post as yourself"
              title="Post as yourself"
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border transition ${
                !isAnonymous
                  ? isDark
                    ? "border-sky-500 bg-slate-800"
                    : "border-[#c446ff] bg-[#f6e8ff]"
                  : isDark
                    ? "border-slate-700 bg-slate-950 hover:bg-slate-900"
                    : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={adminDisplayName}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isDark ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-700"
                }`}>
                  {adminInitial}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsAnonymous(true)}
              aria-pressed={isAnonymous}
              aria-label="Post as Masked"
              title="Post as Masked"
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border transition ${
                isAnonymous
                  ? isDark
                    ? "border-sky-500 bg-slate-800"
                    : "border-[#c446ff] bg-[#f6e8ff]"
                  : isDark
                    ? "border-slate-700 bg-slate-950 hover:bg-slate-900"
                    : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              <img
                src="/masked-avatar.png"
                alt="Masked"
                className="h-7 w-7 rounded-full object-cover"
              />
            </button>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={handleOpenImagePicker}
            disabled={publishing}
            className={`flex-1 rounded-full border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none ${
              isDark
                ? "border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Image
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={publishing}
            className={`flex-1 rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none ${
              isDark
                ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
            }`}
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleImageChange}
      />
    </div>
  );
}

function validatePostImage(file) {
  if (file.size > MAX_POST_IMAGE_FILE_SIZE_BYTES) {
    return "Post image must be 5 MB or smaller.";
  }

  const extension = (file.name.split(".").pop() || "").toLowerCase();

  if (!POST_IMAGE_ALLOWED_EXTENSIONS.has(extension)) {
    return "Post image must be JPG, JPEG, PNG, or WEBP.";
  }

  if (file.type && !POST_IMAGE_ALLOWED_TYPES.has(file.type)) {
    return "Post image must be JPG, JPEG, PNG, or WEBP.";
  }

  return "";
}

export default PostForm;
