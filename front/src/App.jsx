import { useState } from 'react';
import AudioRecorder from './components/AudioRecorder';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Grabador de Audio</h1>
        <p>Graba hasta 10 segundos de audio</p>
      </header>
      <main>
        <AudioRecorder />
      </main>
    </div>
  );
}

export default App;
