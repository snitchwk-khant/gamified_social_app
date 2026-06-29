import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getProfile } from "../services/profile_service";

const AuthContext = createContext(null);

function buildUserState(userInfo, profile = null) {
  const email = userInfo?.email || profile?.email || "";
  const emailPrefix = email.split("@")[0] || "user";
  const fallbackName =
    profile?.full_name || userInfo?.user_metadata?.name || emailPrefix || "Team member";
  const initials =
    (fallbackName || "U")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || (emailPrefix[0] || "U").toUpperCase();
  const role = profile?.role || profile?.position || "Employee";

  return {
    ...userInfo?.user_metadata,
    ...profile,
    id: userInfo?.id,
    email,
    name: fallbackName,
    full_name: fallbackName,
    avatar_url: profile?.avatar_url || null,
    initials,
    role,
    position: profile?.position || null,
    bio: profile?.bio || null,
    must_change_password: profile?.must_change_password ?? false,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();

      if (data?.session?.user) {
        const userInfo = data.session.user;
        let profile = null;

        try {
          profile = await getProfile();
          console.log("PROFILE", profile);
          console.log("ROLE", profile?.role);
          console.log("USER", userInfo);
        } catch (profileError) {
          console.error("Profile sync error:", profileError);
        }

        setUser(buildUserState(userInfo, profile));
      }

      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userInfo = session.user;

        getProfile()
          .then((profile) => {
            console.log("PROFILE", profile);
            console.log("ROLE", profile?.role);
            console.log("USER", userInfo);
            setUser(buildUserState(userInfo, profile));
          })
          .catch((profileError) => {
            console.error("Profile sync error:", profileError);
            setUser(buildUserState(userInfo));
          });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setUser((currentUser) => {
              if (currentUser?.id !== user.id) {
                return currentUser;
              }

              return buildUserState(currentUser);
            });
            return;
          }

          if (!payload.new) {
            return;
          }

          setUser((currentUser) => {
            if (currentUser?.id !== user.id) {
              return currentUser;
            }

            return buildUserState(currentUser, payload.new);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const value = useMemo(
    () => ({
      user,
      loading,

      signIn: async ({ email, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data?.session?.user) {
          throw new Error(error?.message || "Invalid email or password");
        }

        const userInfo = data.session.user;
        let profile = null;

        try {
          profile = await getProfile();
          console.log("PROFILE", profile);
          console.log("ROLE", profile?.role);
          console.log("USER", userInfo);
        } catch (profileError) {
          console.error("Profile sync error:", profileError);
        }

        const nextUser = buildUserState(userInfo, profile);
        setUser(nextUser);

        return nextUser;
      },

      refreshUserProfile: async (profileOverride = null) => {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data?.user) {
          return null;
        }

        let profile = profileOverride;

        if (!profile) {
          try {
            profile = await getProfile();
            console.log("PROFILE", profile);
            console.log("ROLE", profile?.role);
            console.log("USER", data.user);
          } catch (profileError) {
            console.error("Profile sync error:", profileError);
          }
        }

        const nextUser = buildUserState(data.user, profile);
        setUser(nextUser);
        return nextUser;
      },

      signOut: async () => {
        await supabase.auth.signOut();
        setUser(null);
      },
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
