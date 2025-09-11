import { useEffect, useState } from "react";

export function useClientOnly() {
  const isClient = typeof window !== "undefined";
  const [hasMounted, setHasMounted] = useState(isClient);

  useEffect(() => {
    if (!isClient) {
      setHasMounted(true);
    }
  }, [isClient]);

  return hasMounted;
}
