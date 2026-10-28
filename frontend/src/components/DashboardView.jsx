import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Database,
  BarChart2,
  PieChart as PieChartIcon,
  ShieldAlert,
  Server,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { fetchDashboardStats, fetchDashboardLogs } from '../api';

const ERROR_COLORS = {
  rate_limited: '#f59e0b', // Amber / Yellow
  timeout: '#f97316',      // Orange
  dead_model: '#ef4444',   // Rose / Red
  server_error: '#dc2626', // Deep Red
  circuit_open: '#8b5cf6', // Violet
  unknown: '#64748b',      // Slate
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          ● success
        </span>
      );
    case 'rate_limited':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          ● rate_limited
        </span>
      );
    case 'timeout':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          ● timeout
        </span>
      );
    case 'dead_model':
    case 'server_error':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          ● {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          ● {status}
        </span>
      );
  }
};

const getTierBadge = (tier) => {
  switch (tier) {
    case 'tier1':
      return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">T1: Fast</span>;
    case 'tier2':
      return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">T2: Balanced</span>;
    case 'tier3':
      return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">T3: Deep</span>;
    default:
      return <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{tier || '-'}</span>;
  }
};

export default function DashboardView() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (isSilent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const [statsData, logsData] = await Promise.all([
        fetchDashboardStats(),
        fetchDashboardLogs(50),
      ]);

      setStats(statsData);
      setLogs(logsData.logs || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format latency data for BarChart
  const latencyChartData = (stats?.model_performance || [])
    .filter((m) => m.avg_latency_ms > 0 || m.count > 0)
    .map((m) => ({
      name: m.model_slug.split('/').pop() || m.model_slug,
      fullName: m.model_slug,
      avg_latency_ms: m.avg_latency_ms,
      count: m.count,
      success_count: m.success_count,
    }));

  // Format error data for PieChart
  const errorChartData = (stats?.error_breakdown || []).map((err) => ({
    name: err.status,
    value: err.count,
    color: ERROR_COLORS[err.status] || ERROR_COLORS.unknown,
  }));

  const totalErrors = errorChartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6 text-slate-900">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              NIM Router Performance & Analytics
            </h2>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              Live SQLite Data
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry, routing latency, circuit breaker resilience, and SQLite execution history.
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing || isLoading}
          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-emerald-600 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
          />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-3 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Requests</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {isLoading ? '...' : (stats?.total_requests ?? 0).toLocaleString()}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Routing attempts logged</p>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Success Rate</span>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                (stats?.success_rate ?? 0) >= 90
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                  : 'bg-amber-50 border-amber-100 text-amber-600'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-3xl font-semibold tracking-tight ${
                (stats?.success_rate ?? 0) >= 90 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {isLoading ? '...' : `${stats?.success_rate ?? 0}%`}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Target SLA &gt; 90.0%</p>
          </div>
        </div>

        {/* Avg Latency */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Latency</span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {isLoading ? '...' : `${stats?.avg_latency_ms ?? 0} ms`}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Successful stream duration</p>
          </div>
        </div>

        {/* Total Fallbacks */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Fallbacks</span>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                (stats?.total_fallbacks ?? 0) > 0
                  ? 'bg-amber-50 border-amber-100 text-amber-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-3xl font-semibold tracking-tight ${
                (stats?.total_fallbacks ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {isLoading ? '...' : (stats?.total_fallbacks ?? 0).toLocaleString()}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Cascade resilience activations</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Model Latency */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Average Latency by Model (ms)</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {latencyChartData.length} active models
            </span>
          </div>

          <div className="h-64 w-full">
            {latencyChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Server className="w-8 h-8 mb-2 stroke-[1.5] text-slate-300" />
                No latency records available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={latencyChartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
                >
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      color: '#0f172a',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(val, name, props) => [
                      `${val} ms (${props.payload.count} reqs)`,
                      props.payload.fullName,
                    ]}
                  />
                  <Bar
                    dataKey="avg_latency_ms"
                    fill="#4f46e5"
                    radius={[4, 4, 0, 0]}
                    name="Avg Latency (ms)"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart: Error Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <PieChartIcon className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">Routing Failure Breakdown</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {totalErrors} total failures
            </span>
          </div>

          <div className="h-64 w-full">
            {totalErrors === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-emerald-700 text-xs">
                <CheckCircle className="w-10 h-10 mb-2 text-emerald-500" />
                <span className="font-medium">Zero router failures! 100% clean responses.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={errorChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {errorChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      color: '#0f172a',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(val, name) => [`${val} occurrences`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Database Explorer Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Database Explorer: Latest Routing Logs
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspecting the 50 most recent entries in SQLite <code className="text-slate-800 font-mono bg-slate-100 px-1 py-0.5 rounded">routing_logs</code>
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Showing {logs.length} records
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Model Slug</th>
                <th className="py-2.5 px-3">Tier</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Latency</th>
                <th className="py-2.5 px-3 text-center">Attempt</th>
                <th className="py-2.5 px-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No routing logs recorded yet. Send a message in Chat to see real-time routing telemetry!
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateStr = log.created_at
                    ? new Date(log.created_at).toLocaleTimeString()
                    : '-';
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors font-mono"
                    >
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap" title={log.created_at || ''}>
                        {dateStr}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {log.model_slug}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getTierBadge(log.tier)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                        {log.latency_ms !== null && log.latency_ms !== undefined
                          ? `${log.latency_ms} ms`
                          : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-500 whitespace-nowrap">
                        #{log.attempt_num}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs" title={log.error || log.message_content || ''}>
                        {log.error ? (
                          <span className="text-rose-600">{log.error}</span>
                        ) : log.message_content ? (
                          <span className="text-slate-600 truncate block">{log.message_content}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
