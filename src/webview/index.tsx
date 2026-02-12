import React from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"

// Import template SCSS variables and animations
import "@/styles/_variables.scss"
import "@/styles/_keyframe-animations.scss"

const container = document.getElementById("root")
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
