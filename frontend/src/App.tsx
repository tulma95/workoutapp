import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<h1>nSuns 4-Day LP</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
