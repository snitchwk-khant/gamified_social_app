import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SplashScreen as CapacitorSplashScreen } from "@capacitor/splash-screen";
import SafeAreaLayout from "../components/layout/SafeAreaLayout";
import { supabase } from "../lib/supabase";
import { getLeaderboardSettings } from "../services/leaderboard_settings_service";
import { getProfile } from "../services/profile_service";
import "./SplashScreen.css";

const SPLASH_DURATION_MS = 1800;
const FADE_OUT_MS = 250;
const SPLASH_ARTWORK_URL = "/gemify-splash-artwork.png";
const SPLASH_LOGO_URL = "/pwa-icon-512.png";

async function preloadInitialAppData() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  Promise.allSettled([
    session?.user ? getProfile() : Promise.resolve(null),
    getLeaderboardSettings(),
  ]).catch((error) => {
    console.error("Splash app data preload error:", error);
  });

  return session;
}

function SplashScreen() {
  const navigate = useNavigate();
  const [artworkReady, setArtworkReady] = useState(false);
  const [phase, setPhase] = useState("entering");
  const timersRef = useRef([]);
  const animationFrameRef = useRef(null);
  const nativeHideFrameRef = useRef(null);
  const preloadRef = useRef(Promise.resolve(null));

  useEffect(() => {
    nativeHideFrameRef.current = window.requestAnimationFrame(() => {
      CapacitorSplashScreen.hide().catch(() => undefined);
    });

    let isMounted = true;
    const artwork = new Image();
    const logo = new Image();

    artwork.src = SPLASH_ARTWORK_URL;
    logo.src = SPLASH_LOGO_URL;
    preloadRef.current = preloadInitialAppData().catch((error) => {
      console.error("Splash preload error:", error);
      return null;
    });

    artwork
      .decode()
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) {
          setArtworkReady(true);
        }
      });

    return () => {
      isMounted = false;

      if (nativeHideFrameRef.current) {
        window.cancelAnimationFrame(nativeHideFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!artworkReady) {
      return undefined;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      setPhase("visible");

      timersRef.current.push(
        window.setTimeout(() => {
          setPhase("leaving");
        }, SPLASH_DURATION_MS - FADE_OUT_MS)
      );
      timersRef.current.push(
        window.setTimeout(() => {
          preloadRef.current.then((session) => {
            navigate(session?.user ? "/home" : "/login", { replace: true });
          });
        }, SPLASH_DURATION_MS)
      );
    });

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = [];
    };
  }, [artworkReady, navigate]);

  return (
    <SafeAreaLayout
      as="main"
      className={`gemify-splash gemify-splash--${phase}`}
      style={artworkReady ? { "--gemify-splash-artwork": `url(${SPLASH_ARTWORK_URL})` } : undefined}
      aria-label="Gemify loading"
    >
      <div className="gemify-splash__background" />
      <div className="gemify-splash__veil" />
      <div className="gemify-splash__mark">
        <span className="gemify-splash__sparkle gemify-splash__sparkle--one" />
        <span className="gemify-splash__sparkle gemify-splash__sparkle--two" />
        <span className="gemify-splash__sparkle gemify-splash__sparkle--three" />
        <img className="gemify-splash__logo" src={SPLASH_LOGO_URL} alt="Gemify" draggable="false" />
      </div>
    </SafeAreaLayout>
  );
}

export default SplashScreen;
