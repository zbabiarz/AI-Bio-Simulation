import { X, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function InstallPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { profile, updateProfile } = useAuth();
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    const android = /android/.test(userAgent);

    setIsIOS(ios);
    setIsAndroid(android);

    if (profile && profile.install_prompt_count !== undefined && profile.install_prompt_count < 2) {
      setIsOpen(true);
      updateProfile({ install_prompt_count: (profile.install_prompt_count || 0) + 1 });
    }
  }, [profile?.id]);

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center justify-center w-16 h-16 bg-sky-100 rounded-full mx-auto mb-4">
          <Smartphone className="w-8 h-8 text-sky-600" />
        </div>

        <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
          Install The AI-MD
        </h2>
        <p className="text-center text-gray-600 mb-6">
          Add this app to your home screen for quick and easy access
        </p>

        {isIOS && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Tap the <strong>Share</strong> button at the bottom of Safari
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Tap <strong>"Add"</strong> in the top right corner
                </p>
              </div>
            </div>
          </div>
        )}

        {isAndroid && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Tap the <strong>Menu</strong> button (three dots) in your browser
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Tap <strong>"Add"</strong> or <strong>"Install"</strong> to confirm
                </p>
              </div>
            </div>
          </div>
        )}

        {!isIOS && !isAndroid && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Open this site on your mobile device
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Look for your browser's <strong>"Add to Home Screen"</strong> option
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <p className="text-gray-800">
                  Follow the prompts to install the app
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleClose}
          className="mt-6 w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
