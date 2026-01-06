interface DeviceLogoProps {
  deviceId: string;
  deviceName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const logoMap: Record<string, string> = {
  oura: '/oura-logo.svg',
  whoop: '/whoop-logo.svg',
  apple: '/apple-watch-logo.svg',
};

export default function DeviceLogo({ deviceId, deviceName, size = 'md', className = '' }: DeviceLogoProps) {
  const logoPath = logoMap[deviceId];

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  if (!logoPath) {
    const initial = deviceName.charAt(0).toUpperCase();
    return (
      <span className={`font-bold text-white ${className}`}>
        {initial}
      </span>
    );
  }

  return (
    <img
      src={logoPath}
      alt={`${deviceName} logo`}
      className={`${sizeClasses[size]} object-contain ${className}`}
    />
  );
}
