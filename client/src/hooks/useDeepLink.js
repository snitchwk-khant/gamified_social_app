import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DeepLinkService from "../services/deep_link_service";

function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    DeepLinkService.start(navigate);

    return () => {
      DeepLinkService.stop();
    };
  }, [navigate]);

  return {
    openDeepLink: (payload) => DeepLinkService.navigate(payload, navigate),
    resolveDeepLink: DeepLinkService.resolve,
  };
}

export default useDeepLink;
