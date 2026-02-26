import { useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';

const GoogleSignIn = ({ onSuccess, onError, buttonText = "Continue with Google" }) => {
  const { googleLogin } = useContext(AuthContext);
  const googleButtonRef = useRef(null);

  useEffect(() => {
    if (window.google && googleButtonRef.current) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left'
        }
      );
    }
  }, []);

  const handleCredentialResponse = async (response) => {
    try {
      const result = await googleLogin(response.credential);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      if (onError) {
        onError(error);
      }
    }
  };

  return (
    <div className="google-signin-container">
      <div ref={googleButtonRef} className="google-signin-button"></div>
    </div>
  );
};

export default GoogleSignIn;