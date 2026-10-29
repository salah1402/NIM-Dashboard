import React, { useState } from 'react';
import { Eye, Code, Download, X, Copy, Check, ExternalLink } from 'lucide-react';

export default function ArtifactPane({ artifact, onClose }) {
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="flex flex-col h-full bg-[#F9F9F8] text-[#1D1B1B] select-none">
      {/* Artifact Pane Header */}
      <div className="h-12 border-b border-[#E5E3DE] bg-[#F9F9F8] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-md bg-[#C96442]/10 border border-[#C96442]/30 flex items-center justify-center text-[#C96442]">
            <ExternalLink className="w-3 h-3" />
          </div>
          <span className="font-semibold text-xs text-[#1D1B1B]">Artifact Preview</span>
          <span className="text-[10px] bg-[#F0EFEA] text-stone-600 border border-[#E5E3DE] px-1.5 py-0.5 rounded font-mono">
            Live
          </span>
        </div>

        {/* View Switcher Toggle & Action Buttons */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-[#F0EFEA] p-0.5 rounded-lg border border-[#E5E3DE] text-xs">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
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
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                viewMode === 'code'
                  ? 'bg-white text-[#1D1B1B] shadow-xs'
                  : 'text-stone-500 hover:text-[#1D1B1B]'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          <div className="h-4 w-px bg-[#E5E3DE] mx-1" />

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download HTML"
            className="p-1.5 text-stone-500 hover:text-[#1D1B1B] hover:bg-[#F0EFEA] rounded-lg transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close Artifact Pane"
            className="p-1.5 text-stone-500 hover:text-[#1D1B1B] hover:bg-[#F0EFEA] rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Artifact Content Area */}
      <div className="flex-1 overflow-hidden relative bg-white">
        {viewMode === 'preview' ? (
          <iframe
            title="Artifact Live Preview"
            srcDoc={getProcessedSrcDoc(artifact)}
            sandbox="allow-scripts allow-modals"
            className="w-full h-full border-0 bg-white"
          />
        ) : (
          <div className="w-full h-full bg-stone-950 text-stone-200 overflow-auto p-4 font-mono text-xs leading-relaxed">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-800 text-[11px] text-stone-400">
              <span className="uppercase tracking-wider">Raw Source</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="!bg-transparent !p-0 !m-0 !border-0 font-mono text-stone-200 whitespace-pre-wrap">
              <code>{artifact}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
