import { createContext, useContext } from "react";

export const SosCallContext = createContext(null);

export function useSosCall() {
  const context = useContext(SosCallContext);

  if (!context) {
    throw new Error("useSosCall must be used inside SosCallProvider");
  }

  return context;
}
