import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { fetchPricingZones } from "./lib/delivery-zones";

// Preload pricing zones cache
fetchPricingZones();

createRoot(document.getElementById("root")!).render(<App />);
