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
  Database,
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
  rate_limited: '#F59E0B', // Amber
  timeout: '#F97316',      // Orange
  dead_model: '#EF4444',   // Red
  server_error: '#F43F5E', // Rose
  circuit_open: '#A855F7', // Purple
  unknown: '#71717A',      // Zinc-500
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
    case 'circuit_open':
    case 'skipped_circuit_open':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          ● circuit_open
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
      return <Badge variant="emerald" className="text-[10px] font-mono">T3: Deep Reasoning</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] font-mono">{tier || '-'}</Badge>;
  }
};

const cleanModelShortName = (slug) => {
  if (!slug) return '';
  const withoutProvider = slug.includes('/') ? slug.split('/')[1] : slug;
  let cleaned = withoutProvider
    .replace('-instruct', '')
    .replace('-preview', '')
    .replace('-chat', '')
    .replace('-it', '');
  return cleaned.length > 14 ? cleaned.slice(0, 14) + '…' : cleaned;
};

export default function DashboardView() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      setError(null);
      const [statsData, logsData] = await Promise.all([
        fetchDashboardStats(),
        fetchDashboardLogs(100),
      ]);
      setStats(statsData);
      setLogs(logsData.logs || []);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError('Failed to fetch dashboard metrics. Is backend connected?');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const formatTimeAgo = (isoString) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now - date) / 1000);
      if (diffSec < 10) return 'just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  const chartData = (stats?.model_performance || [])
    .filter((m) => m.requests > 0)
    .map((m) => ({
      name: cleanModelShortName(m.model_slug),
      fullSlug: m.model_slug,
      avgLatency: m.avg_latency_ms || 0,
      p95Latency: m.p95_latency_ms || 0,
      requests: m.requests || 0,
      successCount: m.success_count || 0,
      rate: m.requests ? Math.round((m.success_count / m.requests) * 100) : 0,
    }));

  const errorChartData = (stats?.error_breakdown || []).map((err) => ({
    name: err.status,
    value: err.count,
    color: ERROR_COLORS[err.status] || ERROR_COLORS.unknown,
  }));

  const totalErrors = errorChartData.reduce((acc, curr) => acc + curr.value, 0);
  const isHealthyRate = (stats?.success_rate ?? 0) >= 80;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9F9F8] p-6 md:p-8 space-y-8 text-stone-900 font-sans">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E3DE] pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-stone-900 flex items-center gap-2 font-sans">
                Router Telemetry & Analytics
              </h2>
            </div>
            <Badge variant="success" className="text-[10px] py-0.5">Live Database</Badge>
          </div>
          <p className="text-xs text-stone-500 mt-1 pl-10.5">
            Real-time latency benchmarks, cascade routing telemetry, and MongoDB Atlas execution history.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            className="text-xs font-medium cursor-pointer shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-600 mr-1.5 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh Metrics'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-3 text-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <Card className="hover:border-stone-400 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase tracking-wider font-mono">
              Total Invocations
            </CardTitle>
            <div className="w-7 h-7 rounded-md bg-[#F0EFEA] border border-[#E5E3DE] flex items-center justify-center text-stone-600">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-stone-900">
              {isLoading ? '...' : (stats?.total_requests ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">Multi-tier cascade router attempts</p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="hover:border-stone-400 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase tracking-wider font-mono">
              Delivery Success
            </CardTitle>
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center border ${
                isHealthyRate
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-1.5">
              <div
                className={`text-2xl font-bold tracking-tight ${
                  isHealthyRate ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {isLoading ? '...' : `${stats?.success_rate ?? 0}%`}
              </div>
              <span className="text-xs font-medium text-stone-500 font-mono">
                reliability
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">Zero dropped end-user chats</p>
          </CardContent>
        </Card>

        {/* Avg Latency */}
        <Card className="hover:border-stone-400 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase tracking-wider font-mono">
              Latency (Mean)
            </CardTitle>
            <div className="w-7 h-7 rounded-md bg-[#F0EFEA] border border-[#E5E3DE] flex items-center justify-center text-stone-600">
              <Clock className="w-3.5 h-3.5 text-stone-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-1.5">
              <div className="text-2xl font-bold tracking-tight text-stone-900">
                {isLoading ? '...' : `${stats?.avg_latency_ms ?? 0}`}
              </div>
              <span className="text-xs font-mono text-stone-500">ms</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">Average generation turnaround</p>
          </CardContent>
        </Card>

        {/* Total Fallbacks */}
        <Card className="hover:border-stone-400 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-stone-500 uppercase tracking-wider font-mono">
              Cascades Triggered
            </CardTitle>
            <div className="w-7 h-7 rounded-md bg-[#F0EFEA] border border-[#E5E3DE] flex items-center justify-center text-stone-600">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-700">
              {isLoading ? '...' : (stats?.total_fallbacks ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">Rate limit & 404 auto-recoveries</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Benchmarks by Model */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[#E5E3DE]">
            <div>
              <CardTitle className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-600" />
                Model Latency Benchmarks
              </CardTitle>
              <CardDescription className="text-xs text-stone-500 mt-0.5">
                Mean and 95th-percentile execution latency per model (ms)
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">P95 Benchmarks</Badge>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 text-xs">
                  <Activity className="w-8 h-8 mb-2 opacity-50 text-stone-300" />
                  <span>No latency benchmarks yet. Execute chats to generate metrics.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis
                      dataKey="name"
                      stroke="#A8A29E"
                      fontSize={11}
                      tickLine={false}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#A8A29E"
                      fontSize={11}
                      tickLine={false}
                      unit="ms"
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E3DE',
                        borderRadius: '12px',
                        color: '#1D1B1B',
                        fontSize: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                      }}
                      formatter={(val, name) => [`${val} ms`, name === 'avgLatency' ? 'Mean Latency' : 'P95 Latency']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullSlug || label}
                    />
                    <Bar
                      dataKey="avgLatency"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      name="Mean Latency"
                    />
                    <Bar
                      dataKey="p95Latency"
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                      name="P95 Latency"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fallback & Error Breakdown Pie Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[#E5E3DE]">
            <div>
              <CardTitle className="text-sm font-semibold text-stone-900 flex items-center gap-2">
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
                  <CheckCircle className="w-10 h-10 mb-2 text-emerald-600" />
                  <span className="font-medium">100% clean responses across all model endpoints.</span>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-7">
                    <span className="text-2xl font-bold tracking-tight text-stone-900">
                      {totalErrors}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-stone-500 font-mono">
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
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E5E3DE',
                          borderRadius: '12px',
                          color: '#1D1B1B',
                          fontSize: '12px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
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
            <CardTitle className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Recent Execution Logs
            </CardTitle>
            <CardDescription className="text-xs text-stone-500 mt-0.5">
              Live audit stream persisted in MongoDB <code className="text-emerald-700 font-mono">nim_dashboard</code>
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
                        <td className="py-2.5 px-4 font-semibold text-stone-900 whitespace-nowrap">
                          {log.model_slug}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {getTierBadge(log.tier)}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-stone-900 whitespace-nowrap">
                          {log.latency_ms !== null && log.latency_ms !== undefined
                            ? `${log.latency_ms} ms`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-center font-medium text-stone-500 whitespace-nowrap">
                          #{log.attempt_num}
                        </td>
                        <td className="py-2.5 px-4 text-stone-600 max-w-xs truncate" title={log.error || log.message_content || ''}>
                          {log.error ? (
                            <span className="text-rose-600 truncate block font-sans">{log.error}</span>
                          ) : log.message_content ? (
                            <span className="text-stone-800 truncate block font-sans">{log.message_content}</span>
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
