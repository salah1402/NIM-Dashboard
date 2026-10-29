import React, { useState } from 'react';
import { Eye, Code, Download, X, Copy, Check, Sparkles, Globe, RotateCw } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function ArtifactPane({ artifact, onClose }) {
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const getProcessedSrcDoc = (code) => {
    if (!code) return '';
    const trimmed = code.trim();
    if (trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')) {
      return trimmed;
    }
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        padding: 24px;
        margin: 0;
        background: #ffffff;
        color: #1d1b1b;
      }
    </style>
  </head>
  <body>
    ${trimmed}
  </body>
</html>`;
  };

  const handleCopyCode = () => {
    if (!artifact) return;
    navigator.clipboard.writeText(artifact);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!artifact) return;
    const processed = getProcessedSrcDoc(artifact);
    const blob = new Blob([processed], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'artifact.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-zinc-100 select-none border-l border-zinc-800">
      {/* Top macOS-style / Luxury Browser Chrome Header */}
      <div className="h-13 border-b border-zinc-800 bg-[#0c0c0e] px-4 flex items-center justify-between shrink-0 gap-3">
        {/* Left: Window Controls & Title */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308]/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/80 inline-block" />
          </div>
          <div className="h-3.5 w-px bg-zinc-800" />
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-md bg-[#C96442]/15 border border-[#C96442]/30 flex items-center justify-center text-[#E07A5A]">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="font-semibold text-xs text-zinc-100">Live Artifact</span>
            <Badge variant="terracotta" className="text-[10px] py-0 px-1.5">Sandbox</Badge>
          </div>
        </div>

        {/* Center: Fake Browser Address Capsule */}
        <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[11px] text-zinc-400 shadow-xs max-w-xs truncate">
          <Globe className="w-3 h-3 text-[#E07A5A]" />
          <span className="font-mono text-[10px] text-zinc-300">canvas://live-preview.html</span>
        </div>

        {/* Right: View Toggle, Reload, Download, Close */}
        <div className="flex items-center space-x-2">
          {/* View Switcher Toggle */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition cursor-pointer text-xs font-medium ${
                viewMode === 'preview'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition cursor-pointer text-xs font-medium ${
                viewMode === 'code'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          <div className="h-3.5 w-px bg-zinc-800" />

          {/* Reload Preview */}
          {viewMode === 'preview' && (
            <button
              type="button"
              onClick={handleReload}
              title="Reload Preview"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download HTML"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close Artifact Pane (Esc)"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Artifact Content Area */}
      <div className="flex-1 overflow-hidden relative bg-zinc-950">
        {viewMode === 'preview' ? (
          <iframe
            key={iframeKey}
            title="Artifact Live Preview"
            srcDoc={getProcessedSrcDoc(artifact)}
            sandbox="allow-scripts allow-modals"
            className="w-full h-full border-0 bg-white"
          />
        ) : (
          <div className="w-full h-full bg-[#09090b] text-zinc-200 overflow-auto p-4 font-mono text-xs leading-relaxed">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800 text-[11px] text-zinc-400">
              <span className="uppercase tracking-wider font-semibold text-zinc-300">Raw Component Code</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition cursor-pointer text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied to clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono text-zinc-200 whitespace-pre-wrap selection:bg-[#C96442]/30">
              <code>{artifact}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
