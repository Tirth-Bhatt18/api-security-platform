import { useNavigate } from 'react-router-dom';

function BackButton({ fallbackTo = '/dashboard', label = 'Back' }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  };

  return (
    <button type="button" className="back-btn" onClick={handleBack}>
      {label}
    </button>
  );
}

export default BackButton;
