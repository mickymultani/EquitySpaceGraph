import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import Home from "@/src/pages/GraphPage";
import Investigate from "@/src/pages/InvestigatePage";
import BackfillPage from "@/src/pages/BackfillPage";
import IntelligencePage from "@/components/intelligence-page";
import "@/src/styles.css";

function App(){
  const path=window.location.pathname.replace(/\/+$/,"")||"/";
  if(path==="/stories")return <IntelligencePage mode="stories"/>;
  if(path==="/catalysts")return <IntelligencePage mode="catalysts"/>;
  if(path==="/investigate")return <Investigate/>;
  if(path==="/backfill")return <BackfillPage/>;
  return <Home/>;
}

const root=document.getElementById("root");
if(!root)throw new Error("Application root was not found");
createRoot(root).render(<StrictMode><App/></StrictMode>);
