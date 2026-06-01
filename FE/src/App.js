import { useState, useEffect } from 'react';
import './styles/App.css';

function App() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHello();
  }, []);

  const fetchHello = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/hello');
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage('Error connecting to backend: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 SEP490 - Group 48</h1>
        <p>React + Node.js + SQL Server Project</p>
        
        <div className="demo-section">
          <button onClick={fetchHello} disabled={loading}>
            {loading ? 'Loading...' : 'Fetch Hello World'}
          </button>
          
          {message && (
            <div className="message-box">
              <p>{message}</p>
            </div>
          )}
        </div>

        <div className="info-section">
          <h2>Project Structure:</h2>
          <ul>
            <li>📁 <strong>BE/</strong> - Backend (Node.js + Express)</li>
            <li>📁 <strong>FE/</strong> - Frontend (React)</li>
            <li>🗄️ SQL Server - Database</li>
          </ul>
        </div>
      </header>
    </div>
  );
}

export default App;
