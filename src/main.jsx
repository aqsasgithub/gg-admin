import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { store } from './store';
import './index.css';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <Provider store={store}>
            <BrowserRouter>
                <App />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: { borderRadius: 8, fontSize: 14 },
                        success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
                        error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
                    }}
                />
            </BrowserRouter>
        </Provider>
    </StrictMode>,
);
