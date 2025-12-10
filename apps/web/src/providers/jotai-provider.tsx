"use client";

import { createStore, Provider } from "jotai";
// import { DevTools } from "jotai-devtools";
// import "jotai-devtools/styles.css";

const store = createStore();

export const JotaiProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <Provider store={store}>
      {/* <DevTools store={store} /> */}
      {children}
    </Provider>
  );
};
