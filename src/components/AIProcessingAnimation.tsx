import { useState, useEffect } from 'react';
import { Brain, Activity, Sparkles, FileText } from 'lucide-react';

interface AIProcessingAnimationProps {
  stage?: 'analyzing' | 'calculating' | 'personalizing' | 'generating';
  compact?: boolean;
}

const stages = [
  { key: 'analyzing', label: 'Analyzing your physiological data', icon: Activity, duration: 2500 },
  { key: 'calculating', label: 'Calculating risk trajectories', icon: Brain, duration: 2500 },
  { key: 'personalizing', label: 'Personalizing clinical insights', icon: Sparkles, duration: 2500 },
  { key: 'generating', label: 'Generating your report', icon: FileText, duration: 2500 },
];

function NeuralNetworkBackground() {
  const nodes = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: 15 + (i % 4) * 25 + Math.random() * 10,
    y: 20 + Math.floor(i / 4) * 30 + Math.random() * 10,
  }));

  const connections = [
    [0, 4], [0, 5], [1, 4], [1, 5], [1, 6], [2, 5], [2, 6], [2, 7], [3, 6], [3, 7],
    [4, 8], [4, 9], [5, 8], [5, 9], [5, 10], [6, 9], [6, 10], [6, 11], [7, 10], [7, 11],
  ];

  return (
    <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {connections.map(([from, to], i) => (
        <line
          key={`conn-${i}`}
          x1={nodes[from].x}
          y1={nodes[from].y}
          x2={nodes[to].x}
          y2={nodes[to].y}
          stroke="currentColor"
          strokeWidth="0.3"
          className="text-primary animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
      {nodes.map((node) => (
        <circle
          key={`node-${node.id}`}
          cx={node.x}
          cy={node.y}
          r="1.5"
          className="fill-primaryAccent animate-pulse"
          style={{ animationDelay: `${node.id * 150}ms` }}
        />
      ))}
    </svg>
  );
}

function FloatingParticles() {
  const particles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 4,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 3,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primaryAccent/30"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animation: `float ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function PulsingBrain({ className }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
      <div className="absolute inset-2 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
      <div className="relative w-20 h-20 bg-gradient-to-br from-primary to-primaryDark rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
        <Brain className="w-10 h-10 text-white animate-pulse" />
      </div>
      <div className="absolute -inset-1 rounded-full bg-primaryAccent/20 blur-xl animate-pulse" />
    </div>
  );
}

function ProgressBar({ progress, stageIndex }: { progress: number; stageIndex: number }) {
  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="relative h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primaryAccent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-white/30 rounded-full animate-shimmer"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        {stages.map((stage, i) => (
          <div
            key={stage.key}
            className={`transition-colors duration-300 ${
              i <= stageIndex ? 'text-primary font-medium' : ''
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIProcessingAnimation({ stage: externalStage, compact = false }: AIProcessingAnimationProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (externalStage) {
      const stageIndex = stages.findIndex(s => s.key === externalStage);
      if (stageIndex !== -1) {
        setCurrentStageIndex(stageIndex);
        setProgress((stageIndex + 1) * 25);
      }
      return;
    }

    const stageInterval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        const next = (prev + 1) % stages.length;
        return next;
      });
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const target = ((currentStageIndex + 1) / stages.length) * 100;
        if (prev < target) {
          return Math.min(prev + 2, target);
        }
        return prev;
      });
    }, 100);

    return () => {
      clearInterval(stageInterval);
      clearInterval(progressInterval);
    };
  }, [externalStage, currentStageIndex]);

  const currentStage = stages[currentStageIndex];
  const StageIcon = currentStage.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary/5 to-primaryAccent/5 dark:from-primary/10 dark:to-primaryAccent/10 rounded-lg border border-primary/20">
        <div className="relative">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <StageIcon className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{currentStage.label}</p>
          <div className="mt-1 h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      <NeuralNetworkBackground />
      <FloatingParticles />

      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        <PulsingBrain className="mx-auto mb-8" />

        <div className="relative mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
              <StageIcon className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white transition-opacity duration-500">
              {currentStage.label}
            </h2>
          </div>

          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {currentStageIndex === 0 && "Processing your HRV and deep sleep patterns..."}
            {currentStageIndex === 1 && "Modeling disease progression pathways..."}
            {currentStageIndex === 2 && "Applying your age and health profile..."}
            {currentStageIndex === 3 && "Composing your personalized clinical summary..."}
          </p>
        </div>

        <ProgressBar progress={progress} stageIndex={currentStageIndex} />

        <div className="mt-6 flex justify-center gap-2">
          {stages.map((stage, i) => (
            <div
              key={stage.key}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                i === currentStageIndex
                  ? 'bg-primary scale-125'
                  : i < currentStageIndex
                  ? 'bg-primary/50'
                  : 'bg-gray-300 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>

        <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
          AI-powered analysis in progress
        </p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.3;
          }
          25% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-10px) translateX(-5px);
            opacity: 0.4;
          }
          75% {
            transform: translateY(-30px) translateX(15px);
            opacity: 0.5;
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(100%);
            opacity: 0;
          }
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
