import { useState } from 'react';
import { uploadScan } from '../services/api';
import BackButton from '../components/BackButton';

function UploadScanPage() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!file) {
      setError('Please choose a Postman collection JSON file.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Invalid file type. Please upload a .json collection.');
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const response = await uploadScan(file, (evt) => {
        if (evt.total) {
          setProgress(Math.round((evt.loaded * 100) / evt.total));
        }
      });

      setSuccess(`Scan #${response.scan.id} created successfully.`);
      setFile(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stack-lg">
      <div className="row-left">
        <BackButton fallbackTo="/dashboard" label="Back" />
      </div>

      <div className="hero-panel">
        <div>
          <p className="eyebrow">Start Scan</p>
          <h2>Upload Postman Collection</h2>
          <p className="muted">Send a v2.1 collection and the platform will queue security scanning automatically.</p>
        </div>
      </div>

      <form className="card form-stack" onSubmit={handleUpload}>
        <label>
          Collection File (.json)
          <input type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        {loading ? (
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span>{progress}%</span>
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p className="ok-text">{success}</p> : null}

        <button type="submit" className="solid-btn" disabled={loading}>
          {loading ? 'Uploading...' : 'Upload and Start Scan'}
        </button>
      </form>
    </section>
  );
}

export default UploadScanPage;
