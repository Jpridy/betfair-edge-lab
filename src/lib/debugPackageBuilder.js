import JSZip from 'jszip';
import { createDebugPackageFiles } from '@/lib/debugPackageFiles';

export function debugPackageFilename(now = new Date()) {
  return `betfair-edge-lab-debug-package-${now.toISOString().slice(0,19).replace('T','-').replaceAll(':','-')}.zip`;
}

export async function buildDebugPackage(state, options = {}) {
  const result = createDebugPackageFiles(state, options);
  const zip = new JSZip();
  Object.entries(result.files).forEach(([path, content]) => zip.file(path, content ?? ''));
  const blob = await zip.generateAsync({ type:options.outputType || 'blob', compression:'DEFLATE', compressionOptions:{level:6} });
  return { ...result, blob, zipFiles:Object.keys(result.files) };
}

export function downloadDebugBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}