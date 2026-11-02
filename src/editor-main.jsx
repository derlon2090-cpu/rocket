import React from 'react';
import {createRoot} from 'react-dom/client';
import {Editor} from './Editor.jsx';
import './editor.css';
import './editor-polish.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><Editor /></React.StrictMode>);
