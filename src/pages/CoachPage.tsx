import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ChatMessage, HealthMetric } from '../types';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  Trash2,
  Heart,
  Moon,
  Footprints,
  Battery,
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

const suggestedQuestions = [
  'How can I improve my HRV?',
  'Why is my sleep efficiency low?',
  'What does my recovery score mean?',
  'How should I adjust my activity levels?',
  'Analyze my health trends',
  'What are my biggest health opportunities?',
];

export default function CoachPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchMessages();
      fetchMetrics();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      setMessages(data);
    }
  }

  async function fetchMetrics() {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', user!.id)
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: false });

    if (data) {
      setMetrics(data);
    }
  }

  async function sendMessage(content: string) {
    if (!user || !content.trim()) return;

    const userMessage: Omit<ChatMessage, 'id'> = {
      user_id: user.id,
      role: 'user',
      content: content.trim(),
      metadata: null,
      created_at: new Date().toISOString(),
    };

    const { data: savedUserMsg } = await supabase
      .from('chat_messages')
      .insert(userMessage)
      .select()
      .single();

    if (savedUserMsg) {
      setMessages((prev) => [...prev, savedUserMsg]);
    }

    setInput('');
    setLoading(true);

    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

    const response = generateAIResponse(content, metrics);

    const assistantMessage: Omit<ChatMessage, 'id'> = {
      user_id: user.id,
      role: 'assistant',
      content: response,
      metadata: { context: 'health_coaching' },
      created_at: new Date().toISOString(),
    };

    const { data: savedAssistantMsg } = await supabase
      .from('chat_messages')
      .insert(assistantMessage)
      .select()
      .single();

    if (savedAssistantMsg) {
      setMessages((prev) => [...prev, savedAssistantMsg]);
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'chat_with_coach',
      details: { question_type: categorizeQuestion(content) },
    });

    setLoading(false);
  }

  function categorizeQuestion(question: string): string {
    const q = question.toLowerCase();
    if (q.includes('hrv')) return 'hrv';
    if (q.includes('sleep')) return 'sleep';
    if (q.includes('activity') || q.includes('steps') || q.includes('exercise')) return 'activity';
    if (q.includes('recovery')) return 'recovery';
    if (q.includes('stress')) return 'stress';
    return 'general';
  }

  function generateAIResponse(question: string, data: HealthMetric[]): string {
    const q = question.toLowerCase();

    if (data.length === 0) {
      return "I don't have any health data to analyze yet. Please upload your wearable data first, and I'll be able to provide personalized insights and recommendations based on your metrics.";
    }

    const avgHrv = data.filter(d => d.hrv).reduce((sum, d) => sum + (d.hrv || 0), 0) / (data.filter(d => d.hrv).length || 1);
    const avgSleep = data.filter(d => d.sleep_duration_minutes).reduce((sum, d) => sum + (d.sleep_duration_minutes || 0), 0) / (data.filter(d => d.sleep_duration_minutes).length || 1);
    const avgSteps = data.filter(d => d.steps).reduce((sum, d) => sum + (d.steps || 0), 0) / (data.filter(d => d.steps).length || 1);
    const avgRecovery = data.filter(d => d.recovery_score).reduce((sum, d) => sum + (d.recovery_score || 0), 0) / (data.filter(d => d.recovery_score).length || 1);
    const avgSleepEfficiency = data.filter(d => d.sleep_efficiency).reduce((sum, d) => sum + (d.sleep_efficiency || 0), 0) / (data.filter(d => d.sleep_efficiency).length || 1);

    if (q.includes('hrv')) {
      if (avgHrv > 0) {
        const hrvStatus = avgHrv > 50 ? 'good' : avgHrv > 30 ? 'moderate' : 'below average';
        return `Your average HRV over the past 30 days is ${Math.round(avgHrv)}ms, which is ${hrvStatus}. HRV (Heart Rate Variability) is a key indicator of your autonomic nervous system health and recovery status.

**To improve your HRV:**
1. **Prioritize sleep consistency** - Go to bed and wake up at the same time daily
2. **Practice deep breathing** - 5-10 minutes of slow, diaphragmatic breathing before bed
3. **Reduce alcohol intake** - Even moderate drinking can significantly impact HRV
4. **Manage stress** - Chronic stress suppresses HRV; consider meditation or yoga
5. **Stay hydrated** - Dehydration can lower HRV by affecting blood volume

A higher HRV generally indicates better cardiovascular fitness and stress resilience. Based on your data, ${avgHrv > 40 ? "you're doing well - keep up your current habits" : "there's room for improvement through the lifestyle changes mentioned above"}.`;
      }
      return "I don't have HRV data available. This metric is crucial for understanding your recovery and stress levels. Make sure your wearable is tracking HRV and sync your latest data.";
    }

    if (q.includes('sleep efficiency') || (q.includes('sleep') && q.includes('low'))) {
      if (avgSleepEfficiency > 0) {
        const efficiency = Math.round(avgSleepEfficiency);
        return `Your average sleep efficiency is ${efficiency}%. ${efficiency >= 85 ? "This is excellent!" : efficiency >= 75 ? "This is decent but there's room for improvement." : "This indicates you may be spending too much time in bed awake."}

**To improve sleep efficiency:**
1. **Only go to bed when sleepy** - Don't lie in bed scrolling or watching TV
2. **Wake at the same time daily** - Even on weekends, to strengthen your circadian rhythm
3. **Limit time in bed** - If you can't sleep within 20 minutes, get up briefly
4. **Create a cool, dark environment** - Ideal temperature is 65-68°F (18-20°C)
5. **Avoid stimulants after 2pm** - Caffeine has a 6+ hour half-life
6. **Get morning sunlight** - 10-15 minutes of bright light helps set your sleep-wake cycle

Your average sleep duration is ${Math.round(avgSleep / 60 * 10) / 10} hours. ${avgSleep / 60 >= 7 ? "The duration is good - focus on quality" : "Try to increase your total sleep time to 7-8 hours"}.`;
      }
      return "I need more sleep data to analyze your sleep efficiency. Please sync your wearable to get personalized sleep insights.";
    }

    if (q.includes('sleep')) {
      const sleepHours = Math.round(avgSleep / 60 * 10) / 10;
      return `Based on your data, you're averaging ${sleepHours} hours of sleep per night. ${sleepHours >= 7 ? "This meets the recommended 7-9 hours for adults." : "This is below the recommended 7-9 hours for adults."}

**Sleep Quality Tips:**
- Your sleep consistency is important - try to maintain regular sleep/wake times
- ${avgSleepEfficiency > 0 ? `Your sleep efficiency is ${Math.round(avgSleepEfficiency)}%` : "Track sleep efficiency for deeper insights"}
- Deep sleep and REM are crucial for recovery and memory consolidation
- Consider tracking sleep stages if your device supports it

**Impact on Performance:**
${sleepHours < 7 ? "Insufficient sleep can reduce HRV, increase stress hormones, and impair recovery. Even adding 30 minutes could significantly improve your metrics." : "Good sleep duration supports optimal recovery and cognitive function. Focus on maintaining this consistency."}`;
    }

    if (q.includes('recovery')) {
      if (avgRecovery > 0) {
        return `Your average recovery score is ${Math.round(avgRecovery)}%. ${avgRecovery >= 80 ? "Excellent! Your body is recovering well." : avgRecovery >= 60 ? "Good, but there's room to optimize." : "This suggests your body needs more recovery support."}

**Factors Affecting Recovery:**
1. **Sleep quality** - The foundation of recovery
2. **HRV trends** - ${avgHrv > 0 ? `Your avg HRV of ${Math.round(avgHrv)}ms ${avgHrv > 45 ? "supports good recovery" : "suggests recovery could be improved"}` : "Track HRV for insights"}
3. **Training load** - Balance intensity with rest days
4. **Nutrition** - Adequate protein and micronutrients support repair
5. **Stress levels** - Chronic stress impairs recovery

**Recommendations:**
${avgRecovery < 70 ? "- Consider adding an extra rest day this week\n- Focus on sleep quality improvements\n- Reduce training intensity until recovery improves" : "- Maintain your current habits\n- You have capacity for challenging workouts\n- Monitor for any declining trends"}`;
      }
      return "I need recovery score data to provide insights. Many wearables calculate this - make sure it's enabled and synced.";
    }

    if (q.includes('activity') || q.includes('steps') || q.includes('exercise')) {
      return `Your average daily steps over the past 30 days is ${Math.round(avgSteps).toLocaleString()}. ${avgSteps >= 10000 ? "Great job hitting the 10,000 step benchmark!" : avgSteps >= 7500 ? "Good activity level - aim for 10,000 for optimal benefits." : "There's room to increase your daily movement."}

**Activity Recommendations:**
1. **Add walking breaks** - 5-10 minute walks throughout the day add up
2. **Track active minutes** - Focus on moderate-to-vigorous activity
3. **Balance with recovery** - ${avgRecovery > 0 ? `Your recovery score of ${Math.round(avgRecovery)}% suggests you ${avgRecovery > 70 ? "can handle more activity" : "should focus on recovery before increasing intensity"}` : "Monitor how activity affects your recovery"}

**Health Impact:**
- Each additional 2,000 steps reduces cardiovascular risk
- Regular movement improves sleep quality and HRV
- Aim for consistency over occasional high-activity days

${avgSteps < 7500 ? "Start with adding 1,000-2,000 steps daily. Small increases are more sustainable than dramatic changes." : "You're at a healthy activity level. Consider adding strength training or varying your activities."}`;
    }

    if (q.includes('analyze') || q.includes('trend') || q.includes('overview') || q.includes('opportunities')) {
      return `**Your 30-Day Health Overview:**

📊 **Key Metrics:**
${avgHrv > 0 ? `- HRV: ${Math.round(avgHrv)}ms ${avgHrv > 50 ? "(strong)" : avgHrv > 35 ? "(moderate)" : "(needs attention)"}` : "- HRV: No data"}
${avgSleep > 0 ? `- Sleep: ${Math.round(avgSleep / 60 * 10) / 10} hours ${avgSleep / 60 >= 7 ? "(good duration)" : "(below recommended)"}` : "- Sleep: No data"}
${avgSteps > 0 ? `- Steps: ${Math.round(avgSteps).toLocaleString()} ${avgSteps >= 10000 ? "(excellent)" : avgSteps >= 7500 ? "(good)" : "(room to improve)"}` : "- Steps: No data"}
${avgRecovery > 0 ? `- Recovery: ${Math.round(avgRecovery)}% ${avgRecovery >= 75 ? "(healthy)" : "(needs support)"}` : "- Recovery: No data"}

**Top Opportunities:**
${avgSleep / 60 < 7 ? "1. **Sleep Duration** - Increasing to 7+ hours would likely improve all other metrics\n" : ""}${avgSteps < 8000 ? "2. **Daily Activity** - Adding 2,000+ steps could boost energy and sleep quality\n" : ""}${avgHrv > 0 && avgHrv < 40 ? "3. **HRV Improvement** - Focus on stress management and sleep consistency\n" : ""}

**Recommended Next Steps:**
1. Run a bio-simulation to see how specific changes could impact your health
2. Set a goal for your biggest opportunity area
3. Track for another week and review trends

Would you like me to elaborate on any specific metric or recommendation?`;
    }

    return `Thanks for your question! Based on your health data over the past 30 days:

📈 **Your Metrics Summary:**
${avgHrv > 0 ? `- Average HRV: ${Math.round(avgHrv)}ms` : ""}
${avgSleep > 0 ? `- Average Sleep: ${Math.round(avgSleep / 60 * 10) / 10} hours` : ""}
${avgSteps > 0 ? `- Average Steps: ${Math.round(avgSteps).toLocaleString()}` : ""}
${avgRecovery > 0 ? `- Average Recovery: ${Math.round(avgRecovery)}%` : ""}

I'm here to help you understand your health data and make improvements. You can ask me about:
- **HRV trends** and how to improve them
- **Sleep quality** and optimization tips
- **Activity levels** and exercise recommendations
- **Recovery** and stress management
- **Bio-simulations** to predict outcomes

What aspect of your health would you like to focus on?`;
  }

  async function clearHistory() {
    if (!user) return;

    await supabase.from('chat_messages').delete().eq('user_id', user.id);
    setMessages([]);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-primaryDeep mb-1">AI Bio-Coach</h1>
          <p className="text-gray-400 text-sm">
            Your personal health assistant powered by AI
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear History
          </button>
        )}
      </div>

      {metrics.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <QuickStat icon={Heart} label="HRV" value={metrics[0]?.hrv ? `${Math.round(metrics[0].hrv)}ms` : '--'} />
          <QuickStat icon={Moon} label="Sleep" value={metrics[0]?.sleep_duration_minutes ? `${Math.round(metrics[0].sleep_duration_minutes / 60 * 10) / 10}h` : '--'} />
          <QuickStat icon={Footprints} label="Steps" value={metrics[0]?.steps ? metrics[0].steps.toLocaleString() : '--'} />
          <QuickStat icon={Battery} label="Recovery" value={metrics[0]?.recovery_score ? `${metrics[0].recovery_score}%` : '--'} />
        </div>
      )}

      <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primaryAccent rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-primaryDeep mb-2">
                Welcome to your AI Bio-Coach
              </h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                I can help you understand your health data, interpret trends, and provide personalized recommendations.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => sendMessage(question)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-50 text-gray-700 text-sm rounded-lg transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primaryAccent rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl p-4 ${
                  message.role === 'user'
                    ? 'bg-primary/20 text-primaryDeep'
                    : 'bg-gray-50 text-gray-700'
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none">
                  {message.content.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} className="font-semibold text-primaryDeep my-2">{line.replace(/\*\*/g, '')}</p>;
                    }
                    if (line.startsWith('- ') || line.startsWith('1. ') || line.match(/^\d+\./)) {
                      return <p key={i} className="ml-4 my-1">{line}</p>;
                    }
                    if (line.startsWith('📊') || line.startsWith('📈') || line.startsWith('💡')) {
                      return <p key={i} className="font-semibold my-2">{line}</p>;
                    }
                    return line ? <p key={i} className="my-1">{line}</p> : <br key={i} />;
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {format(parseISO(message.created_at), 'h:mm a')}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-700" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primaryAccent rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                <span className="text-gray-400 text-sm">Analyzing your data...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your health data..."
              className="flex-1 bg-white border border-gray-200 rounded-lg py-3 px-4 text-primaryDeep placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-primary to-primaryAccent hover:from-primaryDark hover:to-primaryAccent text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {suggestedQuestions.slice(0, 3).map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => setInput(question)}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-50 text-gray-600 text-xs rounded transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {question}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}

interface QuickStatProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function QuickStat({ icon: Icon, label, value }: QuickStatProps) {
  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <p className="text-primaryDeep font-semibold">{value}</p>
    </div>
  );
}
