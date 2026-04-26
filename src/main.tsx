import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.tsx";
import "./index.css";

const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

createRoot(document.getElementById("root")!).render(
  <Auth0Provider
    domain="dev-obve604xicp5grwj.us.auth0.com"
    clientId="xg9S1Z8ecC2gGE7vCquKIgn21mBfgWCd"
    cacheLocation="localstorage"
    authorizationParams={{
      redirect_uri: window.location.origin,
      audience,
    }}
  >
    <App />
  </Auth0Provider>,
);
