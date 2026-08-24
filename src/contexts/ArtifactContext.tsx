"use client";

import React, { createContext, useContext, useState } from "react";

export interface Artifact {
  id?: string;
  language: string;
  content: string;
  title?: string;
  subtitle?: string;
  type?: "code" | "react" | "html" | "svg" | "markdown" | "image";
}

interface ArtifactContextType {
  activeArtifact: Artifact | null;
  setActiveArtifact: (artifact: Artifact | null) => void;
}

export const ArtifactContext = createContext<ArtifactContextType>({
  activeArtifact: null,
  setActiveArtifact: () => {},
});

export function ArtifactProvider({ children }: { children: React.ReactNode }) {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);

  return (
    <ArtifactContext.Provider value={{ activeArtifact, setActiveArtifact }}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifact() {
  return useContext(ArtifactContext);
}
