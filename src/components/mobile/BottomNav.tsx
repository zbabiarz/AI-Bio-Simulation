import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Brain, Smartphone, User, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { name: 'Home', href: '/analytics', icon: BarChart3 },
  { name: 'Simulate', href: '/simulation', icon: Brain },
  { name: 'Connect', href: '/devices', icon: Smartphone },
  { name: 'Profile', href: '/settings', icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const { profile } = useAuth();

  const displayItems = profile?.is_admin
    ? [...navItems.slice(0, 3), { name: 'Admin', href: '/admin', icon: Settings }]
    : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <div className="glass-effect border-t border-gray-200/50 dark:border-slate-700/50 pb-safe">
        <div className="flex items-center justify-around px-2 h-16">
          {displayItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href === '/analytics' && location.pathname === '/');

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center min-w-[64px] h-12 px-3 rounded-2xl transition-all duration-200 touch-target ${
                  isActive
                    ? 'bg-primary/10 dark:bg-primary/20'
                    : 'active:bg-gray-100 dark:active:bg-slate-800'
                }`}
              >
                <div className={`relative ${isActive ? 'scale-110' : ''} transition-transform duration-200`}>
                  <item.icon
                    className={`w-6 h-6 transition-colors duration-200 ${
                      isActive
                        ? 'text-primary'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium mt-1 transition-colors duration-200 ${
                    isActive
                      ? 'text-primary'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
