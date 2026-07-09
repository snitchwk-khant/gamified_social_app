import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/theme_context";
import { useAuth } from "../../context/auth_context";

const MAX_POST_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_POST_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const POST_IMAGE_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const POST_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const POST_VIDEO_ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const POST_VIDEO_ALLOWED_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function PostForm({ value, onChange, onSubmit }) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const imageInputRef = useRef(null);
  const { isDark } = useTheme();
  const { user } = useAuth();

  const adminDisplayName = user?.full_name || user?.name || "Administrator";
  const adminInitial = (adminDisplayName?.charAt(0) || "A").toUpperCase();
  const selectedFileIsVideo = selectedImages.length === 1 ? isPostVideoFile(selectedImages[0]) : false;

  useEffect(() => {
    if (!selectedImages.length) {
      setPreviewUrls([]);
      return undefined;
    }

    const nextPreviewUrls = selectedImages.map((file) => URL.createObjectURL(file));
    setPreviewUrls(nextPreviewUrls);

    return () => {
      nextPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedImages]);

  const handleSubmit = async () => {
    const trimmedValue = value?.trim();

    if (!trimmedValue && selectedImages.length === 0) {
      setError("Write something or add media to publish.");
      return;
    }

    setError("");
    setPublishing(true);

    try {
      const result = await onSubmit(trimmedValue, isAnonymous, selectedImages);

      if (result === false || result?.success === false) {
        setError(result?.error || "Something went wrong. Please try again.");
      } else {
        setSelectedImages([]);
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
    const files = Array.from(input.files || []);

    if (!files.length) {
      return;
    }

    const includesVideo = files.some((file) => isPostVideoFile(file));

    if (includesVideo && files.length > 1) {
      setError("Select one video or multiple images.");
      setSelectedImages([]);
      input.value = "";
      return;
    }

    const validationMessage = files.map(validatePostImage).find(Boolean);

    if (validationMessage) {
      setError(validationMessage);
      setSelectedImages([]);
      input.value = "";
      return;
    }

    setError("");
    setSelectedImages(files);
    input.value = "";
  };

  const handleRemoveImage = () => {
    setSelectedImages([]);
    setError("");
  };

  return (
    <div
      className={`border-y px-3 py-3 transition duration-300 sm:rounded-2xl sm:border sm:p-6 ${
        isDark
          ? "border-slate-800 bg-slate-950 shadow-none sm:bg-slate-900 sm:shadow-lg sm:shadow-slate-950/10 sm:hover:border-slate-700"
          : "border-slate-200 bg-white shadow-none sm:shadow-sm sm:hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-2.5 sm:block">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full sm:hidden">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={adminDisplayName} className="h-full w-full object-cover" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center text-sm font-semibold ${
              isDark ? "bg-slate-800 text-slate-100" : "bg-slate-200 text-slate-700"
            }`}>
              {adminInitial}
            </div>
          )}
        </div>
        <textarea
          rows="2"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What's on your mind?"
          className={`min-h-11 w-full resize-none rounded-[22px] border px-4 py-3 text-[15px] leading-6 outline-none transition sm:min-h-[128px] sm:rounded-2xl sm:py-4 sm:text-sm ${
            isDark
              ? "border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 sm:bg-slate-950"
              : "border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-500 focus:border-[#c446ff] focus:bg-white sm:border-slate-300"
          }`}
        />
      </div>

      {previewUrls.length ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <div className="relative">
            {selectedFileIsVideo ? (
              <video
                src={previewUrls[0]}
                controls
                muted
                playsInline
                preload="metadata"
                className="max-h-[360px] w-full bg-black object-contain"
              />
            ) : (
              <div className="flex snap-x snap-mandatory overflow-x-auto">
                {previewUrls.map((previewUrl, index) => (
                  <img
                    key={previewUrl}
                    src={previewUrl}
                    alt={`Selected post preview ${index + 1}`}
                    className="max-h-[360px] w-full shrink-0 snap-center object-contain"
                  />
                ))}
              </div>
            )}
            {previewUrls.length > 1 ? (
              <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
                {previewUrls.length} images
              </span>
            ) : null}
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
            className={`min-h-11 flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none sm:py-3 ${
              isDark
                ? "border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Media
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={publishing}
            className={`min-h-11 flex-1 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none sm:py-3 ${
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
        multiple
        accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleImageChange}
      />
    </div>
  );
}

function validatePostImage(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  const isImage = POST_IMAGE_ALLOWED_EXTENSIONS.has(extension);
  const isVideo = POST_VIDEO_ALLOWED_EXTENSIONS.has(extension);

  if (!isImage && !isVideo) {
    return "Post media must be JPG, JPEG, PNG, WEBP, MP4, MOV, or WebM.";
  }

  if (isImage && file.size > MAX_POST_IMAGE_FILE_SIZE_BYTES) {
    return "Post image must be 5 MB or smaller.";
  }

  if (isVideo && file.size > MAX_POST_VIDEO_FILE_SIZE_BYTES) {
    return "Post video must be 50 MB or smaller.";
  }

  if (file.type && isImage && !POST_IMAGE_ALLOWED_TYPES.has(file.type)) {
    return "Post image must be JPG, JPEG, PNG, or WEBP.";
  }

  if (file.type && isVideo && !POST_VIDEO_ALLOWED_TYPES.has(file.type)) {
    return "Post video must be MP4, MOV, or WebM.";
  }

  return "";
}

function isPostVideoFile(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  return file.type?.startsWith("video/") || POST_VIDEO_ALLOWED_EXTENSIONS.has(extension);
}

export default PostForm;
