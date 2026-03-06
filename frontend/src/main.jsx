import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
const g=document.createElement('style');
g.textContent=`*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0c10;color:#e8ecf4;font-family:'DM Sans',sans-serif}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#0a0c10}::-webkit-scrollbar-thumb{background:#1e2330;border-radius:4px}input,select,textarea{font-family:'DM Sans',sans-serif}a{text-decoration:none;color:inherit}`;
document.head.appendChild(g);
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
