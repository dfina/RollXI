import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base set to the repo name so assets and data resolve correctly
// when served from https://<username>.github.io/RollXI/
export default defineConfig({
  plugins: [react()],
  base: "/RollXI/"
});
