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
    <div className="flex flex-col h-full bg-[#F9F9F8] text-[#1D1B1B] select-none border-l border-[#E5E3DE]">
      {/* Top macOS-style / Luxury Browser Chrome Header */}
      <div className="h-13 border-b border-[#E5E3DE] bg-[#F9F9F8] px-4 flex items-center justify-between shrink-0 gap-3">
        {/* Left: Window Controls & Title */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308]/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/80 inline-block" />
          </div>
          <div className="h-3.5 w-px bg-[#E5E3DE]" />
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="font-semibold text-xs text-stone-900">Live Artifact</span>
            <Badge variant="emerald" className="text-[10px] py-0 px-1.5">Sandbox</Badge>
          </div>
        </div>

        {/* Center: Fake Browser Address Capsule */}
        <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 bg-white border border-[#E5E3DE] rounded-full text-[11px] text-stone-600 shadow-xs max-w-xs truncate">
          <Globe className="w-3 h-3 text-emerald-600" />
          <span className="font-mono text-[10px] text-stone-700">canvas://live-preview.html</span>
        </div>

        {/* Right: View Toggle, Reload, Download, Close */}
        <div className="flex items-center space-x-2">
          {/* View Switcher Toggle */}
          <div className="flex items-center bg-[#F0EFEA] p-0.5 rounded-lg border border-[#E5E3DE] text-xs">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition cursor-pointer text-xs font-medium ${
                viewMode === 'preview'
                  ? 'bg-white text-[#1D1B1B] shadow-xs'
                  : 'text-stone-500 hover:text-[#1D1B1B]'
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
                  ? 'bg-white text-[#1D1B1B] shadow-xs'
                  : 'text-stone-500 hover:text-[#1D1B1B]'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          <div className="h-3.5 w-px bg-[#E5E3DE]" />

          {/* Reload Preview */}
          {viewMode === 'preview' && (
            <button
              type="button"
              onClick={handleReload}
              title="Reload Preview"
              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-[#F0EFEA] rounded-lg transition cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download HTML"
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-[#F0EFEA] rounded-lg transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close Artifact Pane (Esc)"
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-[#F0EFEA] rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Artifact Content Area */}
      <div className="flex-1 overflow-hidden relative bg-[#F9F9F8]">
        {viewMode === 'preview' ? (
          <iframe
            key={iframeKey}
            title="Artifact Live Preview"
            srcDoc={getProcessedSrcDoc(artifact)}
            sandbox="allow-scripts allow-modals"
            className="w-full h-full border-0 bg-white"
          />
        ) : (
          <div className="w-full h-full bg-stone-950 text-stone-100 overflow-auto p-4 font-mono text-xs leading-relaxed">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-800 text-[11px] text-stone-400">
              <span className="uppercase tracking-wider font-semibold text-stone-300">Raw Component Code</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white transition cursor-pointer text-xs"
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
            <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono text-stone-200 whitespace-pre-wrap selection:bg-emerald-500/30">
              <code>{artifact}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
