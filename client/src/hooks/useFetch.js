import { useEffect, useState } from "react";

function useFetch(request, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    request()
      .then((response) => {
        if (mounted) {
          setData(response);
        }
      })
      .catch((fetchError) => {
        if (mounted) {
          setError(fetchError);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, deps);

  return { data, error, loading };
}

export default useFetch;
