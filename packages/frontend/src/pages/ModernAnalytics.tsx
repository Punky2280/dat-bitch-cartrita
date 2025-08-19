import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Users,
  MessageSquare,
  Clock,
  Cpu,
  HardDrive,
  Zap,
  Brain,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AnalyticsPage: React.FC = () => {
  const { state, actions, dispatch } = useApp();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized || timeRange !== state.analytics.currentTimeRange) {
      actions.loadAnalytics(timeRange);
      setInitialized(true);
    }
  }, [timeRange, initialized, state.analytics.currentTimeRange, actions]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await actions.loadAnalytics(timeRange);
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: { 
          message: 'Analytics refreshed successfully', 
          type: 'success' 
        } 
      });
    } catch (error) {
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: { 
          message: 'Failed to refresh analytics', 
          type: 'error' 
        } 
      });
    } finally {
      setRefreshing(false);
    }
  };

  const metrics = [
    {
      title: 'Total Interactions',
      value: state.analytics.data.interactions?.reduce((acc, m) => acc + m.value, 0) ?? 0,
      change: '+12.5%',
      trend: 'up',
      icon: MessageSquare
    },
    {
      title: 'Active Users',
      value: state.analytics.data.users?.reduce((acc, m) => acc + m.value, 0) ?? 0,
      change: '+8.2%',
      trend: 'up',
      icon: Users
    },
    {
      title: 'Response Time',
      value: state.analytics.data.responseTime?.length ? `${(state.analytics.data.responseTime.reduce((acc, m) => acc + m.value, 0) / state.analytics.data.responseTime.length).toFixed(2)}s` : 'N/A',
      change: '-15.3%',
      trend: 'up',
      icon: Clock
    },
    {
      title: 'Success Rate',
      value: state.analytics.data.successRate?.length ? `${(state.analytics.data.successRate.reduce((acc, m) => acc + m.value, 0) / state.analytics.data.successRate.length).toFixed(1)}%` : 'N/A',
      change: '+2.1%',
      trend: 'up',
      icon: TrendingUp
    }
  ];

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
          <p className="text-slate-400">Monitor performance and usage metrics</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing || state.analytics.loading}
            className="flex items-center space-x-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm text-slate-300">Refresh</span>
          </button>
          <select 
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" 
            value={timeRange} 
            onChange={e => setTimeRange(e.target.value as any)}
            disabled={state.analytics.loading}
          >
            <option value="day">Last 24 hours</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 12 months</option>
          </select>
          <button className="p-2 bg-slate-800 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
            <Filter className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {state.analytics.loading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-slate-600 rounded"></div>
                <div className="w-16 h-4 bg-slate-600 rounded"></div>
              </div>
              <div className="w-20 h-8 bg-slate-600 rounded mb-2"></div>
              <div className="w-24 h-4 bg-slate-600 rounded"></div>
            </div>
          ))
        ) : (
          metrics.map((metric) => (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <metric.icon className="w-8 h-8 text-cyan-400" />
                <div className={`flex items-center space-x-1 text-sm ${
                  metric.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {metric.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{metric.change}</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{metric.value}</h3>
              <p className="text-sm text-slate-400">{metric.title}</p>
            </motion.div>
          ))
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Usage Trends</h3>
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">Chart visualization coming soon</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">System Performance</h3>
          <div className="space-y-4">
            {state.systemStats.loading ? (
              // Loading skeleton for system stats
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between animate-pulse">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-slate-600 rounded"></div>
                    <div className="w-24 h-4 bg-slate-600 rounded"></div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 h-2 bg-slate-600 rounded-full"></div>
                    <div className="w-8 h-4 bg-slate-600 rounded"></div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Cpu className="w-5 h-5 text-blue-400" />
                    <span className="text-slate-300">CPU Usage</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-blue-400 rounded-full h-2 transition-all duration-300" 
                        style={{ width: `${state.systemStats.data.cpu || 0}%` }} 
                      />
                    </div>
                    <span className="text-white text-sm font-medium">{state.systemStats.data.cpu || 0}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="w-5 h-5 text-green-400" />
                    <span className="text-slate-300">Memory Usage</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-green-400 rounded-full h-2 transition-all duration-300" 
                        style={{ width: `${state.systemStats.data.memory || 0}%` }} 
                      />
                    </div>
                    <span className="text-white text-sm font-medium">{state.systemStats.data.memory || 0}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <span className="text-slate-300">AI Processing</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-purple-400 rounded-full h-2 transition-all duration-300" 
                        style={{ width: `${state.systemStats.data.aiLoad || 0}%` }} 
                      />
                    </div>
                    <span className="text-white text-sm font-medium">{state.systemStats.data.aiLoad || 0}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Zap className="w-5 h-5 text-orange-400" />
                    <span className="text-slate-300">Power Efficiency</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-orange-400 rounded-full h-2 transition-all duration-300" 
                        style={{ width: `${state.systemStats.data.powerEfficiency || 0}%` }} 
                      />
                    </div>
                    <span className="text-white text-sm font-medium">{state.systemStats.data.powerEfficiency || 0}%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Recent Activity</h3>
        <div className="space-y-4">
          {state.analytics.loading ? (
            // Loading skeleton for activity
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center space-x-4 p-3 animate-pulse">
                <div className="w-2 h-2 bg-slate-600 rounded-full" />
                <div className="flex-1">
                  <div className="w-48 h-4 bg-slate-600 rounded mb-1"></div>
                  <div className="w-20 h-3 bg-slate-600 rounded"></div>
                </div>
              </div>
            ))
          ) : state.recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">No recent activity</p>
            </div>
          ) : (
            state.recentActivity.map((activity, index) => (
              <div key={activity.id || index} className="flex items-center space-x-4 p-3 hover:bg-slate-700/30 rounded-lg transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'chat' ? 'bg-cyan-400' :
                  activity.type === 'agent' ? 'bg-purple-400' :
                  activity.type === 'system' ? 'bg-emerald-400' :
                  activity.type === 'workflow' ? 'bg-orange-400' :
                  'bg-red-400'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-white">{activity.message}</p>
                  <p className="text-xs text-slate-400">
                    {activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString() : activity.time}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;