import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base './' keeps asset and data paths relative, so the build works on
// GitHub Pages subpaths without configuration.
export default defineConfig({
  plugins: [react()],
  base: "./"
});
