import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, User, ArrowRight, Heart, Brain, Zap, Shield, X } from 'lucide-react';

const ADMIN_PASSCODE = '1234';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdminSignup, setIsAdminSignup] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcode, setPasscode] = useState(['', '', '', '']);
  const [passcodeError, setPasscodeError] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const { error } = await signUp(email, password, fullName, isAdminSignup);
        if (error) throw error;
        navigate(isAdminSignup ? '/admin' : '/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleAdminToggle() {
    if (!isAdminSignup) {
      setShowPasscodeModal(true);
    } else {
      setIsAdminSignup(false);
    }
  }

  function handlePasscodeChange(index: number, value: string) {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newPasscode = [...passcode];
    newPasscode[index] = value;
    setPasscode(newPasscode);
    setPasscodeError('');

    if (value && index < 3) {
      const nextInput = document.getElementById(`passcode-${index + 1}`);
      nextInput?.focus();
    }
  }

  function handlePasscodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !passcode[index] && index > 0) {
      const prevInput = document.getElementById(`passcode-${index - 1}`);
      prevInput?.focus();
    }
  }

  function verifyPasscode() {
    const enteredPasscode = passcode.join('');
    if (enteredPasscode === ADMIN_PASSCODE) {
      setIsAdminSignup(true);
      setShowPasscodeModal(false);
      setPasscode(['', '', '', '']);
      setPasscodeError('');
    } else {
      setPasscodeError('Incorrect passcode. Please try again.');
      setPasscode(['', '', '', '']);
      const firstInput = document.getElementById('passcode-0');
      firstInput?.focus();
    }
  }

  function closePasscodeModal() {
    setShowPasscodeModal(false);
    setPasscode(['', '', '', '']);
    setPasscodeError('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
        <div className="max-w-lg">
          <div className="mb-8">
            <img
              src="https://storage.googleapis.com/msgsndr/QFjnAi2H2A9Cpxi7l0ri/media/695c45adca807cc717540ee9.png"
              alt="AIMD"
              className="h-24 w-auto object-contain"
            />
          </div>

          <h1 className="text-4xl font-bold text-[#0D2B6B] mb-6 leading-tight">
            AI-Powered Bio-Simulation for Your Health Journey
          </h1>

          <p className="text-gray-600 text-lg mb-10">
            Upload your wearable data and unlock personalized insights, predictions, and actionable recommendations powered by advanced AI.
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#1A5BE9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Heart className="w-5 h-5 text-[#1A5BE9]" />
              </div>
              <div>
                <h3 className="text-[#0D2B6B] font-semibold mb-1">Health Insights</h3>
                <p className="text-gray-600 text-sm">Understand your HRV, sleep patterns, and recovery metrics in depth.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#1A5BE9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-[#1A5BE9]" />
              </div>
              <div>
                <h3 className="text-[#0D2B6B] font-semibold mb-1">Bio-Simulations</h3>
                <p className="text-gray-600 text-sm">See how changes in your habits could impact your health outcomes.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#1A5BE9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-[#1A5BE9]" />
              </div>
              <div>
                <h3 className="text-[#0D2B6B] font-semibold mb-1">AI Bio-Coach</h3>
                <p className="text-gray-600 text-sm">Get personalized guidance from your AI health assistant.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <img
              src="https://storage.googleapis.com/msgsndr/QFjnAi2H2A9Cpxi7l0ri/media/695c45adca807cc717540ee9.png"
              alt="AIMD"
              className="h-10 w-auto object-contain"
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-gray-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              {isAdminSignup && !isLogin && (
                <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
              )}
              <h2 className="text-2xl font-bold text-[#0D2B6B] dark:text-white">
                {isLogin ? 'Welcome back' : isAdminSignup ? 'Create Admin Account' : 'Create your account'}
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              {isLogin ? 'Sign in to access your health dashboard' : isAdminSignup ? 'Set up your admin credentials' : 'Start your personalized health journey'}
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg py-3 pl-11 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A5BE9] focus:border-transparent transition-all"
                      placeholder="John Doe"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg py-3 pl-11 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A5BE9] focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg py-3 pl-11 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A5BE9] focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isAdminSignup && !isLogin
                    ? 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white'
                    : 'bg-[#1A5BE9] hover:bg-[#0D2B6B] text-white'
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : isAdminSignup ? 'Create Admin Account' : 'Create Account'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {!isLogin && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleAdminToggle}
                  className={`w-full py-2.5 px-4 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    isAdminSignup
                      ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100'
                      : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  {isAdminSignup ? 'Switch to Regular Account' : 'Create Admin Account'}
                </button>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setIsAdminSignup(false);
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
              >
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <span className="text-[#1A5BE9] font-medium">
                  {isLogin ? 'Sign up' : 'Sign in'}
                </span>
              </button>
            </div>
          </div>

          <p className="text-center text-gray-500 dark:text-gray-400 text-xs mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {showPasscodeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-gray-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-[#0D2B6B] dark:text-white">Admin Verification</h3>
              </div>
              <button
                onClick={closePasscodeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              Enter the 4-digit admin passcode to create an admin account.
            </p>

            <div className="flex justify-center gap-3 mb-4">
              {passcode.map((digit, index) => (
                <input
                  key={index}
                  id={`passcode-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePasscodeChange(index, e.target.value)}
                  onKeyDown={(e) => handlePasscodeKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-[#0D2B6B] dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {passcodeError && (
              <p className="text-red-500 text-sm text-center mb-4">{passcodeError}</p>
            )}

            <button
              onClick={verifyPasscode}
              disabled={passcode.some(d => !d)}
              className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Verify Passcode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
