import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";
import { searchProfiles } from "../../services/profile_service";
import { getProfilePath } from "../../utils/profile_path";

function UserSearch({ inputId = "user-search" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const requestRef = useRef(0);
  const blurTimeoutRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const searchTerm = query.trim();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!searchTerm) {
      setResults([]);
      setLoading(false);
      setError("");
      setIsOpen(false);
      return undefined;
    }

    setIsOpen(true);
    setError("");

    const timeoutId = window.setTimeout(() => {
      setLoading(true);

      searchProfiles(searchTerm, { excludeUserId: user?.id || null })
        .then((profiles) => {
          if (requestRef.current !== requestId) {
            return;
          }

          setResults(profiles);
        })
        .catch((err) => {
          if (requestRef.current !== requestId) {
            return;
          }

          console.error("User Search Error:", err);
          setResults([]);
          setError(err?.message || "Unable to search users.");
        })
        .finally(() => {
          if (requestRef.current === requestId) {
            setLoading(false);
          }
        });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query, user?.id]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function handleSelect(profileId) {
    if (!profileId) {
      return;
    }

    setQuery("");
    setResults([]);
    setIsOpen(false);
    navigate(getProfilePath(profileId, user?.id));
  }

  function handleBlur() {
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  }

  function handleFocus() {
    if (query.trim()) {
      setIsOpen(true);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showPanel = isOpen && query.trim();

  return (
    <div className="relative min-w-0">
      <label htmlFor={inputId} className="sr-only">
        Search users
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onBlur={handleBlur}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Search people"
        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
          isDark
            ? "border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
            : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-[#c446ff]"
        }`}
      />

      {showPanel ? (
        <div
          className={`absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(360px,60vh)] overflow-y-auto rounded-2xl border p-2 shadow-xl ${
            isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"
          }`}
        >
          {loading ? (
            <p className={`px-3 py-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Searching...
            </p>
          ) : null}

          {error ? (
            <p className={`px-3 py-2 text-sm ${isDark ? "text-rose-300" : "text-rose-700"}`}>
              {error}
            </p>
          ) : null}

          {!loading && !error && results.length === 0 ? (
            <p className={`px-3 py-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              No users found.
            </p>
          ) : null}

          {!error
            ? results.map((profile) => {
                const displayName = profile.full_name || profile.email?.split("@")[0] || "Team member";
                const initial = displayName.charAt(0).toUpperCase() || "T";

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(profile.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      isDark ? "hover:bg-slate-900" : "hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
                        isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-100"
                      }`}
                    >
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        <span className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                          {initial}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                        {displayName}
                      </p>
                      <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <span className="max-w-full truncate">ID: {profile.employee_id || "N/A"}</span>
                        <span className="max-w-full truncate">{profile.department || "No department"}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            : null}
        </div>
      ) : null}
    </div>
  );
}

export default UserSearch;
