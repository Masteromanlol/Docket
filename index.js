import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './docket-plus-react.jsx'; // Assuming the main App component is in this file

// Create a root to render the React app into.
// This corresponds to the <div id="root"></div> in your public/index.html file.
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the main App component.
// React.StrictMode is a wrapper that helps with highlighting potential problems in an application.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
