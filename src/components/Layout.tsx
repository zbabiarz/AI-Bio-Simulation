import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Brain,
  Upload,
  User,
  Settings,
  LogOut,
  Shield,
  ChevronDown,
  Moon,
  Sun,
  BarChart3,
} from 'lucide-react';
import BottomNav from './mobile/BottomNav';
import MobileHeader from './mobile/MobileHeader';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Biosimulation', href: '/simulation', icon: Brain },
  { name: 'Upload Data', href: '/devices', icon: Upload },
  { name: 'Health Profile', href: '/intake', icon: User },
];

export default function Layout({ children }: LayoutProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <MobileHeader />

      <aside className="fixed top-0 left-0 z-50 h-full w-64 bg-primaryDeep border-r border-gray-200 dark:border-primaryDark hidden lg:block">
        <div className="flex items-center h-16 px-4 bg-white border-b border-gray-200 w-full">
          <Link to="/simulation" className="flex items-center flex-1">
            <img
              src="https://storage.googleapis.com/msgsndr/QFjnAi2H2A9Cpxi7l0ri/media/695c45adca807cc717540ee9.png"
              alt="AIMD"
              className="h-10 w-auto object-contain"
            />
          </Link>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-white/70 hover:bg-primaryDark hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}

          {profile?.is_admin && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                location.pathname === '/admin'
                  ? 'bg-primary text-white'
                  : 'text-white/70 hover:bg-primaryDark hover:text-white'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Admin</span>
            </Link>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primaryDark">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-primaryDark hover:text-white transition-all"
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 hidden lg:block">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex-1" />

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-gray-300"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
              >
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-primaryDeep dark:text-white">
                    {profile?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{profile?.email}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="pt-14 pb-24 lg:pt-0 lg:pb-6 px-4 lg:px-6 min-h-screen bg-gray-50 dark:bg-black">
          <div className="pt-4 lg:pt-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
