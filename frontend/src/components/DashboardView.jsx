import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Activity,
  BarChart2,
  PieChart as PieChartIcon,
  ShieldAlert,
  Server,
  Layers,
  Database,
  ArrowUpRight,
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
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';

const ERROR_COLORS = {
  rate_limited: '#D97706', // Warm Amber
  timeout: '#EA580C',      // Warm Orange
  dead_model: '#DC2626',   // Red
  server_error: '#BE123C', // Rose
  circuit_open: '#C96442', // Terracotta
  unknown: '#78716C',      // Warm Stone
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          ● success
        </span>
      );
    case 'rate_limited':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          ● rate_limited
        </span>
      );
    case 'timeout':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
          ● timeout
        </span>
      );
    case 'dead_model':
    case 'server_error':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
          ● {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F0EFEA] text-stone-700 border border-[#E5E3DE]">
          ● {status}
        </span>
      );
  }
};

const getTierBadge = (tier) => {
  switch (tier) {
    case 'tier1':
      return <Badge variant="subtle" className="text-[10px] font-mono">T1: Fast</Badge>;
    case 'tier2':
      return <Badge variant="warning" className="text-[10px] font-mono">T2: Balanced</Badge>;
    case 'tier3':
      return <Badge variant="terracotta" className="text-[10px] font-mono">T3: Deep Reasoning</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] font-mono">{tier || '-'}</Badge>;
  }
};

const cleanModelShortName = (slug) => {
  if (!slug) return '';
  const withoutProvider = slug.includes('/') ? slug.split('/')[1] : slug;
  let cleaned = withoutProvider
    .replace(/-instruct(-v\d+(\.\d+)?)?$/i, '')
    .replace(/-it$/i, '');
  if (cleaned.length > 20) {
    cleaned = cleaned.slice(0, 19) + '…';
  }
  return cleaned;
};

const formatTimeAgo = (isoString) => {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
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

  const latencyChartData = (stats?.model_performance || [])
    .filter((m) => m.avg_latency_ms > 0 || m.count > 0)
    .map((m) => ({
      shortName: cleanModelShortName(m.model_slug),
      fullName: m.model_slug,
      avg_latency_ms: m.avg_latency_ms,
      count: m.count,
      success_count: m.success_count,
    }));

  const errorChartData = (stats?.error_breakdown || []).map((err) => ({
    name: err.status,
    value: err.count,
    color: ERROR_COLORS[err.status] || ERROR_COLORS.unknown,
  }));

  const totalErrors = errorChartData.reduce((acc, curr) => acc + curr.value, 0);
  const isHealthyRate = (stats?.success_rate ?? 0) >= 80;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9F9F8] p-6 md:p-8 space-y-8 text-[#1D1B1B]">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E3DE] pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C96442]/10 border border-[#C96442]/20 flex items-center justify-center text-[#C96442]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#1D1B1B] flex items-center gap-2 font-sans">
                Router Telemetry & Analytics
              </h2>
            </div>
            <Badge variant="success" className="text-[10px] py-0.5">Live Database</Badge>
          </div>
          <p className="text-xs text-stone-500 mt-1 pl-10.5">
            Real-time latency benchmarks, cascade routing telemetry, and SQLite execution history.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            className="text-xs font-medium cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#C96442] mr-1.5 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh Metrics'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-3 text-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <Card className="hover:border-[#C96442]/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase tracking-wider font-mono">
              Total Invocations
            </CardTitle>
            <div className="w-7 h-7 rounded-md bg-[#F0EFEA] border border-[#E5E3DE] flex items-center justify-center text-stone-700">
              <Zap className="w-3.5 h-3.5 text-[#C96442]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#1D1B1B]">
              {isLoading ? '...' : (stats?.total_requests ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">Multi-tier cascade router attempts</p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="hover:border-[#C96442]/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase tracking-wider font-mono">
              Delivery Success
            </CardTitle>
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center border ${
                isHealthyRate
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-amber-50 border-amber-200 text-amber-600'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight ${
                isHealthyRate ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {isLoading ? '...' : `${stats?.success_rate ?? 0}%`}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              {isHealthyRate ? 'Optimal circuit breaker status' : 'Failover cascade active'}
            </p>
          </CardContent>
        </Card>

        {/* Avg Latency */}
        <Card className="hover:border-[#C96442]/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase tracking-wider font-mono">
              Mean Latency
            </CardTitle>
            <div className="w-7 h-7 rounded-md bg-[#F0EFEA] border border-[#E5E3DE] flex items-center justify-center text-stone-700">
              <Clock className="w-3.5 h-3.5 text-stone-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#1D1B1B]">
              {isLoading ? '...' : `${stats?.avg_latency_ms ?? 0} ms`}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">First-token roundtrip duration</p>
          </CardContent>
        </Card>

        {/* Fallbacks */}
        <Card className="hover:border-[#C96442]/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase tracking-wider font-mono">
              Cascade Fallbacks
            </CardTitle>
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center border ${
                (stats?.total_fallbacks ?? 0) > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-[#F0EFEA] border-[#E5E3DE] text-stone-400'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight ${
                (stats?.total_fallbacks ?? 0) > 0 ? 'text-amber-600' : 'text-[#1D1B1B]'
              }`}
            >
              {isLoading ? '...' : (stats?.total_fallbacks ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">Automatic failover interventions</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horizontal Bar Chart: Model Latency */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[#E5E3DE]">
            <div>
              <CardTitle className="text-sm font-semibold text-[#1D1B1B] flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#C96442]" />
                Latency by Model Tier (ms)
              </CardTitle>
              <CardDescription className="text-xs text-stone-500 mt-0.5">
                Benchmark comparison across NIM flagship endpoints
              </CardDescription>
            </div>
            <span className="text-xs text-stone-500 font-mono">
              {latencyChartData.length} models
            </span>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              {latencyChartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 text-xs">
                  <Server className="w-8 h-8 mb-2 stroke-[1.5] text-stone-300" />
                  No latency records available yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={latencyChartData}
                    margin={{ top: 10, right: 25, left: 10, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      stroke="#A8A29E"
                      fontSize={11}
                      tickLine={false}
                      unit=" ms"
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      stroke="#78716C"
                      fontSize={11}
                      tickLine={false}
                      width={125}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#E5E3DE',
                        borderRadius: '8px',
                        color: '#1D1B1B',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      }}
                      formatter={(val, name, props) => [
                        `${val} ms (${props.payload.count} reqs)`,
                        props.payload.fullName,
                      ]}
                    />
                    <Bar
                      dataKey="avg_latency_ms"
                      fill="#C96442"
                      radius={[0, 4, 4, 0]}
                      name="Avg Latency"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Donut Chart: Error Breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[#E5E3DE]">
            <div>
              <CardTitle className="text-sm font-semibold text-[#1D1B1B] flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-amber-600" />
                Failure & Fallback Distribution
              </CardTitle>
              <CardDescription className="text-xs text-stone-500 mt-0.5">
                Breakdown of rate limits, timeouts, and status errors
              </CardDescription>
            </div>
            <span className="text-xs text-stone-500 font-mono">
              {totalErrors} total
            </span>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="relative h-64 w-full">
              {totalErrors === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-emerald-700 text-xs">
                  <CheckCircle className="w-10 h-10 mb-2 text-emerald-500" />
                  <span className="font-medium">100% clean responses across all model endpoints.</span>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-7">
                    <span className="text-2xl font-bold tracking-tight text-[#1D1B1B]">
                      {totalErrors}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400 font-mono">
                      Faults
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={errorChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
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
                          borderColor: '#E5E3DE',
                          borderRadius: '8px',
                          color: '#1D1B1B',
                          fontSize: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        }}
                        formatter={(val, name) => [`${val} occurrences`, name]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', color: '#78716C' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Router Activity Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E3DE] pb-4">
          <div>
            <CardTitle className="text-sm font-semibold text-[#1D1B1B] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#C96442]" />
              Recent Execution Logs
            </CardTitle>
            <CardDescription className="text-xs text-stone-500 mt-0.5">
              Live audit stream persisted in SQLite <code className="text-[#C96442] font-mono">nim.db</code>
            </CardDescription>
          </div>
          <span className="text-xs font-mono text-stone-500">
            Showing {logs.length} entries
          </span>
        </CardHeader>

        <CardContent className="pt-4 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F0EFEA] text-stone-600 font-semibold border-b border-[#E5E3DE]">
                  <th className="py-2.5 px-4 font-mono text-[11px]">Timestamp</th>
                  <th className="py-2.5 px-4 font-mono text-[11px]">Model Slug</th>
                  <th className="py-2.5 px-4 font-mono text-[11px]">Tier</th>
                  <th className="py-2.5 px-4 font-mono text-[11px]">Status</th>
                  <th className="py-2.5 px-4 font-mono text-[11px] text-right">Latency</th>
                  <th className="py-2.5 px-4 font-mono text-[11px] text-center">Attempt</th>
                  <th className="py-2.5 px-4 font-mono text-[11px]">Response Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E3DE] text-stone-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-stone-400">
                      No routing logs recorded yet. Send a prompt in the chat to see real-time routing telemetry!
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const timeDisplay = formatTimeAgo(log.created_at);
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-[#F0EFEA]/60 transition-colors font-mono text-xs"
                      >
                        <td className="py-2.5 px-4 text-stone-500 whitespace-nowrap" title={log.created_at || ''}>
                          {timeDisplay}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[#1D1B1B] whitespace-nowrap">
                          {log.model_slug}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {getTierBadge(log.tier)}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-[#1D1B1B] whitespace-nowrap">
                          {log.latency_ms !== null && log.latency_ms !== undefined
                            ? `${log.latency_ms} ms`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-center font-medium text-stone-500 whitespace-nowrap">
                          #{log.attempt_num}
                        </td>
                        <td className="py-2.5 px-4 text-stone-500 max-w-xs truncate" title={log.error || log.message_content || ''}>
                          {log.error ? (
                            <span className="text-rose-600 truncate block font-sans">{log.error}</span>
                          ) : log.message_content ? (
                            <span className="text-stone-700 truncate block font-sans">{log.message_content}</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
