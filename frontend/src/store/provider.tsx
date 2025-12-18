"use client";

import { ReactNode } from "react";
import { Provider as ReactReduxProvider } from "react-redux";
import { store } from "./index";

interface ProviderProps {
  children: ReactNode;
}

export function ReduxProvider({ children }: ProviderProps) {
  return <ReactReduxProvider store={store}>{children}</ReactReduxProvider>;
}
